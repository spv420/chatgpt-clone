const { askClient } = require('./clients/chatgpt-client');
const { askVicuna } = require('./clients/vicuna-client');
const { browserClient } = require('./clients/chatgpt-browser');
const { askStableLM } = require('./clients/stablelm-client');
const { askBing } = require('./clients/bingai');
const titleConvo = require('./titleConvo');
const getCitations = require('../lib/parse/getCitations');
const citeText = require('../lib/parse/citeText');

module.exports = {
  askClient,
  askVicuna,
  askStableLM,
  browserClient,
  askBing,
  titleConvo,
  getCitations,
  citeText
};
