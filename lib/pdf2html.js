"use strict";

var fs = require('fs');
var path = require('path');

var options = {
  images: 'png',
  position: 'absolute'
};

var Pdf2Html = function () {
};

Pdf2Html.prototype.setOptions = function (opts) {
  options.images = opts.images || options.images;
  options.position = opts.position || options.position;
};

Pdf2Html.prototype.convert = function (file, callbackreturn) {

};

Pdf2Html.prototype._constructConvertCommandForPage = function (file) {

}

module.exports = new Pdf2Html;