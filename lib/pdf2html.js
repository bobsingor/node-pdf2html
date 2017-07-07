"use strict";
var util = require("util");
var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');
var humps = require('humps');
var execSync = require('sync-exec');
var _ = require('lodash');
var moment = require('moment');

var Pdf2Html = function () {
};

Pdf2Html.prototype.convert = function (file) { 
  return new Promise(function (resolve, reject) {
    var getInfoCommand = util.format("pdfinfo '%s'", file);
    var result = execSync(getInfoCommand);
    var pdfinfo = {};

    result.stdout.split("\n").forEach(function (line) {
      if (line.match(/^(.*?):[ \t]*(.*)$/)) {
        var key = RegExp.$1;
        var value = RegExp.$2;
        pdfinfo[key] = value;

        if(key.match(/Date/)) {
          var array = value.split(" ");
          var date = array[0] + ', ' + array[2] + ' ' + array[1] + ' ' + array[4] + ' ' + array[3];
          pdfinfo[key] = new Date(date);
        }
      }
    });

    pdfinfo.pdfVersion = pdfinfo['PDF version'];
    delete pdfinfo["PDF version"];
    pdfinfo['File size'] = pdfinfo['File size'].match(/\d+/g)[0];
    pdfinfo = humps.camelizeKeys(pdfinfo);
    return resolve(pdfinfo);
  })
};

module.exports = new Pdf2Html;