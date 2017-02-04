"use strict";
var util = require("util");
var fs = require('fs');
var path = require('path');
var exec = require("child_process").exec;

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

Pdf2Html.prototype.convert = function (file, output) {
  var self = this;
  var command = this._constructConvertCommandForPage(file, output);

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

      console.log(stdout);
    });
  })
};

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