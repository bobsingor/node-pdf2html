"use strict";
var util = require("util");
var fs = require('fs');
var path = require('path');
var exec = require("child_process").exec;
var cheerio = require('cheerio');
var humps = require('humps');
var phantom = require("phantom");
var csso = require('csso');
var minimize = require('minimize');
var execSync = require('sync-exec');
var _ = require('lodash');

var options = {
  images: '',
  position: '',
  fontDir: ''
};  

var Pdf2Html = function () {
};

Pdf2Html.prototype.setOptions = function (opts) {
  opts = opts || {};
  options.images = opts.images || options.images;
  options.position = opts.position || options.position;
  options.fontDir = opts.fontDir || options.fontDir;
};

Pdf2Html.prototype.convert = function (file) {
  var self = this;
  var basename = path.basename(file, '.pdf');
  var dirname = path.dirname(file);
  var outputdir = dirname;
  var output = outputdir + '/' + basename + '.html';
  var fontOutput = dirname + '/fonts';
  var pageCount = 0;
  var pdfinfo = null;
  var command = this._constructConvertCommandForPage(file, output);
  this._createDirectory(outputdir);
  var pdfInfo = this._getPdfInfo(file);
  var convertFonts = this._getFontsFromPdf(file, fontOutput);
  //var createWebfonts = this._createWebfonts(fontOutput);
  var copyFonts = this._copyFonts(fontOutput);
 
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
        self._convertOutput(output, outputdir, pdfInfo.pages);
        return resolve(pdfinfo);
      }, function (error) {
        return reject(error);
      })
    });
  })
};

Pdf2Html.prototype._copyFonts = function (startPath) {
  this._createDirectory(options.fontDir);
  var filter = '.ttf'
  var files=fs.readdirSync(startPath);
  for(var i=0;i<files.length;i++){
      var filename=path.join(startPath,files[i]);
      var stat = fs.lstatSync(filename);

      if (stat.isDirectory()){
        console.log('is directory do nothing')
      }
      else if (filename.indexOf(filter)>=0) {
        var basename = path.basename(filename, '.ttf');
        fs.createReadStream(filename).pipe(fs.createWriteStream(options.fontDir + '/' + basename +'.ttf'));
      }; 
  };
}

Pdf2Html.prototype._getFontsFromPdf = function (file, fontOutput) {
  var dirname = path.dirname(file);
  var extractCommand = util.format("mutool extract '%s'", file);
  this._createDirectory(fontOutput);
  var result = execSync(extractCommand);
  console.log(dirname);

  result.stdout.split("\n").forEach(function (line) {
    if (line.match(/^extracting font (.*)$/)) {
      var font = RegExp.$1;
      var fontPath = dirname + '/' + font;
      console.log(fontPath);
      fs.renameSync(fontPath, dirname + '/fonts/' + font);
    }
  });

  this._removeImages(dirname, '.jpg');
  this._removeImages(dirname, '.pam');
  this._removeImages(dirname, '.png');
  this._convertFontsToTTF(fontOutput);
  return result.stdout;
}

Pdf2Html.prototype._convertFontsToTTF = function (startPath) {
  var self = this;
  if (!fs.existsSync(startPath)){
      console.log("no dir ",startPath);
      return;
  }

  var filter = '.ttf'
  var files=fs.readdirSync(startPath);
  for(var i=0;i<files.length;i++){
      var filename=path.join(startPath,files[i]);
      var stat = fs.lstatSync(filename);

      if (stat.isDirectory()){
        console.log('is directory do nothing')
      }
      else if (filename.indexOf(filter)==-1) {
        this._convertToTTF(filename);
      }; 
  };
}

Pdf2Html.prototype._convertToTTF = function (font) {
  var convertcommand = util.format(__dirname + "/../convert.pe '%s'", font);
  var result = execSync(convertcommand);
  console.log('converted ' + font);
  fs.unlinkSync(font);
  console.log('remove ' + font);
  return result;
}

Pdf2Html.prototype._createWebfonts = function (fontsDir) {
  var createfonts = util.format("webfonts '%s'", fontsDir);
  var result = execSync(createfonts);
}

Pdf2Html.prototype._getPdfInfo = function (file) {
  var self = this;
  var getInfoCommand = util.format("pdfinfo '%s'", file);
  var result = execSync(getInfoCommand);
  var pdfinfo = {};

  result.stdout.split("\n").forEach(function (line) {
    if (line.match(/^(.*?):[ \t]*(.*)$/)) {
      pdfinfo[RegExp.$1] = RegExp.$2;
    }
  });

  pdfinfo.pdfVersion = pdfinfo['PDF version'];
  delete pdfinfo["PDF version"];
  pdfinfo['File size'] = pdfinfo['File size'].match(/\d+/g)[0];
  pdfinfo = humps.camelizeKeys(pdfinfo);
  return pdfinfo;
}

Pdf2Html.prototype._removeImages = function (startPath,filter) {
  //console.log('Starting from dir '+startPath+'/');

  if (!fs.existsSync(startPath)){
      console.log("no dir ",startPath);
      return;
  }

  var files=fs.readdirSync(startPath);
  for(var i=0;i<files.length;i++){
      var filename=path.join(startPath,files[i]);
      var stat = fs.lstatSync(filename);
      if (stat.isDirectory()){
        console.log('is directory do nothing');
      }
      else if (filename.indexOf(filter)>=0) {
        fs.unlinkSync(filename)
      };
  };
}

Pdf2Html.prototype._getFontName = function (font) {
  var getFontName = util.format("fontforge -script getFontName.pe '%s' 2> /dev/null", font);
  var result = execSync(getFontName);
  return result.stdout.replace(/(\r\n|\n|\r)/gm,"");
}

Pdf2Html.prototype._createDirectory = function (dir) {
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

Pdf2Html.prototype._getStyledFonts = function (startPath) {
  var self = this;
  if (!fs.existsSync(startPath)){
      console.log("no dir ",startPath);
      return;
  }

  var filter = '.ttf'
  var files=fs.readdirSync(startPath);
  var fonts = [];

   for(var i=0;i<files.length;i++){
      var filename=path.join(startPath,files[i]);
      var stat = fs.lstatSync(filename);

      if (stat.isDirectory()){
        console.log('is directory do nothing')
      }
      else if (filename.indexOf(filter)>=0) {
        var fontname = self._getFontName(filename);
        var basename = path.basename(filename, '.ttf');

        fonts.push({fontname: fontname, basename: basename});
      }; 
  };

  var text = "";
  var data = _.unionBy(fonts, 'fontname');
  _.forEach(data, function (value) {
    console.log(value.fontname);
    text += "@font-face {font-family: \""+value.fontname+"\"; src: url(\"fonts/"+value.basename+".ttf\");}\n"
  })

  return text;
}

Pdf2Html.prototype._convertOutput = function (output, outputdir, pageCount) {
  var $ = cheerio.load(fs.readFileSync(output), {decodeEntities: false});

  var style = this._getStyledFonts(outputdir + '/fonts');
  style += $('style').html();
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