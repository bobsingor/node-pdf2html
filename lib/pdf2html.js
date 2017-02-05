"use strict";
var util = require("util");
var fs = require('fs');
var path = require('path');
var exec = require("child_process").exec;
var cheerio = require('cheerio');
var humps = require('humps');
var phantom = require("phantom");
var csso = require('csso');
var minimize = require('minimize')

var options = {
  images: '',
  position: ''
};

var Pdf2Html = function () {
};

Pdf2Html.prototype.setOptions = function (opts) {
  opts = opts || {};
  options.images = opts.images || options.images;
  options.position = opts.position || options.position;
};

Pdf2Html.prototype.convert = function (file) {
  var self = this;
  var basename = path.basename(file, '.pdf');
  var dirname = path.dirname(file);
  var outputdir = dirname;
  var output = outputdir + '/' + basename + '.html';
  var pageCount = 0;
  var pdfinfo = null;
  var command = this._constructConvertCommandForPage(file, output);
  this._createOutputDirectory(outputdir);
  this._getPdfInfo(file).then(function (data) {
    pageCount = data.Pages;
    pdfinfo = data;
    pdfinfo.pdfVersion = pdfinfo['PDF version'];
    delete pdfinfo["PDF version"];
    pdfinfo['File size'] = pdfinfo['File size'].match(/\d+/g)[0];
    pdfinfo = humps.camelizeKeys(pdfinfo);
  }, function (error) {

  })
 
  return new Promise(function (resolve, reject) {
    exec(command, function (err, stdout, stderr) {
      if (err) {
        return reject({
          message: "Failed to convert PDF to HTML",
          error: err,
          stdout: stdout,
          stderr: stderr
        })
      }

      self._renderHtml(output).then(function () {
        self._convertOutput(output, outputdir, pageCount);
        return resolve(pdfinfo);
      }, function (error) {
        return reject(error);
      })
    });
  })
};

Pdf2Html.prototype._createOutputDirectory = function (dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

Pdf2Html.prototype._renderHtml = function (output) {
  var _ph, _page, _outObj;
  return new Promise(function (resolve, reject) {
    phantom.create().then(ph => {
        _ph = ph;
        return _ph.createPage();
    }).then(page => {
        _page = page;
        return _page.open(output);
    }).then(status => {
        console.log(status);
        return _page.property('content')
    }).then(content => {
        fs.writeFile(output, content, function (err) {
          if (err) return reject(err);
          resolve();
        });

        _page.close();
        _ph.exit();
    }).catch(e => console.log(e));
  });
}

Pdf2Html.prototype._convertOutput = function (output, outputdir, pageCount) {
  var $ = cheerio.load(fs.readFileSync(output), {decodeEntities: false});

  var style = $('style').html();
  var compressedCss = csso.minify(style).css;

  var cssFile = fs.createWriteStream(outputdir + '/style.css');
  cssFile.write(compressedCss);
  cssFile.end();

  for (var i = 1; i <= pageCount; i++) {
    console.log('write page ' + i);

    $('#page_' + i).find('img').each(function(i, elem) {
      var imageUrl = $(this).attr('src');
      var baseImageUrl = path.basename(imageUrl);

      $(this).attr('src', '<%= imageUrl %>/' + baseImageUrl)
    });

    $('#page_' + i).find('a').each(function(j, elem) {
      var href = $(this).attr('href');
      var re = new RegExp('#page_[0-9]+');
      var re2 = new RegExp('[0-9]+');
      var pageNumber = re.exec(href);

      var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;

      if(regexp.test(href)) return;

      if(!pageNumber) {
        var cnt = $(this).contents();
        $(this).replaceWith(cnt);

        return;
      }

      pageNumber = re2.exec(pageNumber)[0];

      if(i == pageNumber) {
        $(this).attr('href', '#');
      } else {
        $(this).attr('href', '<%= linkUrl %>' + pageNumber);
      }
    });

    var page = $.html('#page_' + i);
    page = new minimize({ quotes: true }).parse(page);
    var htmlFile = fs.createWriteStream(outputdir + '/'+i+'.html');
    htmlFile.write(page);
    htmlFile.end();
  }
}

Pdf2Html.prototype._getPdfInfo = function (file) {
  var self = this;
  var getInfoCommand = util.format("pdfinfo '%s'", file);
  var promise = new Promise(function (resolve, reject) {
    exec(getInfoCommand, function (err, stdout, stderr) {
      if (err) {
        return reject({
          message: "Failed to get PDF'S information",
          error: err,
          stdout: stdout,
          stderr: stderr
        });
      }

      var info = {};
      stdout.split("\n").forEach(function (line) {
        if (line.match(/^(.*?):[ \t]*(.*)$/)) {
          info[RegExp.$1] = RegExp.$2;
        }
      });
      return resolve(info);
    });
  });
  return promise;
}

Pdf2Html.prototype._constructConvertCommandForPage = function (file, output) {
  return util.format(
    "PDF2HTMLBasic %s %s '%s' '%s'",
    options.position ? '-' + options.position : '',
    options.images ? '-' + options.images : '',
    file,
    output
  );
}

module.exports = new Pdf2Html;