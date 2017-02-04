var pdf2html = require('./index.js');

var input   = __dirname + '/test.pdf';

pdf2html.setOptions();

pdf2html.convert(input).then(function (data) {
  console.log(data);
}, function (error) {
  console.log(error)
})