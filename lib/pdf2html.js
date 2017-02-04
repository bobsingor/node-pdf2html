"use strict";
var util = require("util");
var fs = require('fs');
var path = require('path');
var exec = require("child_process").exec;
var cheerio = require('cheerio');

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
  var command = this._constructConvertCommandForPage(file, output);
  this._createOutputDirectory(outputdir);
  this._getPdfInfo(file).then(function (data) {
    pageCount = data.Pages;
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

      self._convertOutput(output, outputdir, pageCount);
      return resolve('done')
    });
  })
};

Pdf2Html.prototype._createOutputDirectory = function (dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

Pdf2Html.prototype._convertOutput = function (output, outputdir, pageCount) {
  var $ = cheerio.load(fs.readFileSync(output), {decodeEntities: false});
  var script = $('script').html();
  var style = $('style').html();

  var cssFile = fs.createWriteStream(outputdir + '/style.css');
  cssFile.write(style);
  cssFile.end();

  var jsFile = fs.createWriteStream(outputdir + '/script.js');
  jsFile.write(script);
  jsFile.end();

  for (var i = 1; i <= pageCount; i++) {
    console.log('write page ' + i);

    $('#page_' + i).find('img').each(function(i, elem) {
      var imageUrl = $(this).attr('src');
      var baseImageUrl = path.basename(imageUrl);

      $(this).attr('src', '<%= imageUrl %>/' + baseImageUrl)
    });

    var page = $.html('#page_' + i);
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