var pdf2html = require('./index.js');

var input   = __dirname + '/test.pdf';
var output   = __dirname + '/test.html';

pdf2html.setOptions({});
pdf2html.convert(input, output).then(function (data) {
  console.log(data);
}, function (error) {
  console.log(error)
})