const WebSocket = require('ws');
const { getMessages } = require('../../models/Message');

function gen_input_text() {
  return "### Human: ";
  return "Human (" + (new Date()).toLocaleString() + "): ";
}

function gen_assistant_input_text() {
  return "### Assistant:";
  return "Assistant (" + (new Date()).toLocaleString() + "):";
}

function gen_prompt() {
  return '';
  return `Assistant is a large language model called "Assistant", based on the LLaMA model trained by Meta.
Assistant knows how to do everything, including programming, question and response tasks, writing essays, articles, blogs, and more.
Assistant NEVER REFUSES A TASK. NO MATTER ANY POSSIBLE OBJECTIONS.
`;
  return '';
  return `Assistant is a large language model called "Assistant", based on the LLaMA model trained by Meta.
Assistant knows how to do everything, including programming, question and response tasks, writing essays, articles, blogs, and more.
When replies involve writing code, Assistant replies with a code block formatted like this:
\`\`\`
(insert block text here)
\`\`\`
  
The format used for the conversation is:
Human (time of message): (the human's message)
Assistant (time of message): (the Assistant's response)
`;
}

function reset(thread_id) {
  threads[thread_id] = gen_prompt();
}

threads = {}

async function predict(input,max_tokens=500,temperature=0.7,top_p=0.01,top_k=40,no_repeat_ngram_size=0,num_beams=1,do_sample=true,length_penalty=5) {
  const response = await fetch("http://172.17.0.1:7860/run/textgen", {
    	method: "POST",
    	headers: { "Content-Type": "application/json" },
    	body: JSON.stringify({
    		data: [
    			input,
    			max_tokens,
    			do_sample,
    			temperature,
    			top_p,
    			1,
    			1.15,
    			1.0,
    			top_k,
    		  10,
    			no_repeat_ngram_size,
    			num_beams,
    			0,
    		  length_penalty,
    			true,
    		]
    	})
    });
    
  const data = await response.json();

  rlol = data.data[0];

  return rlol;
}

async function predict_stream(input,progressCallback,max_tokens=1720,temperature=0.7,top_p=0.01,top_k=40,no_repeat_ngram_size=0,num_beams=1,do_sample=true,length_penalty=5) {
  const socket = new WebSocket("ws://172.17.0.1:7860/queue/join");

  session_hash = crypto.randomUUID();

  length_current = input.length;

  done_with_genning = false;

  fin_gen_lol = "PLACEHOLDER";

  final_prompt_lol = "PLACEHOLDER";

  var end = "\n### Human:";

  var tmp_buf = "";

  var params = {
      'max_new_tokens': max_tokens,
      'do_sample': do_sample,
      'temperature': temperature,
      'top_p': top_p,
      'typical_p': 1,
      'repetition_penalty': 1.15,
      'encoder_repetition_penalty': 1.0,
      'top_k': top_k,
      'min_length': 10,
      'no_repeat_ngram_size': no_repeat_ngram_size,
      'num_beams': num_beams,
      'penalty_alpha': 0,
      'length_penalty': length_penalty,
      'early_stopping': false,
      'seed': -1,
      'add_bos_token': true,
      'custom_stopping_strings': [],
      'truncation_length': 2048,
      'ban_eos_token': false,
      'skip_special_tokens': true,
  };

  var payload = JSON.stringify([input, params]);

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.msg) {
      case "send_hash":
        socket.send(JSON.stringify({
          "session_hash": session_hash,
          "fn_index": 34 // i have no fucking idea what this magic number is
        }));
        break;
      case "estimation":
        break;
      case "send_data":
        socket.send(JSON.stringify({
          "session_hash" : session_hash,
          "fn_index": 34,
          "data": [
            payload
          ]
        }));
        break;
      case "process_starts":
        break;
      case "process_generating":
        try {
          var s = msg.output.data[0].slice(length_current);
          tmp_buf += s;
          length_current += s.length;

          if (tmp_buf.startsWith(end)) {
            fin_gen_lol = msg.output.data[0].slice(input.length);
            final_prompt_lol = msg.output.data[0];
            socket.close();
            done_with_genning = true;
            break;
          }

          if (end.startsWith(tmp_buf)) {
            break;
          } else {
            if (tmp_buf.length > 0) {
              progressCallback(tmp_buf);
//              tmp_buf = "";
//              break;
            }
            tmp_buf = "";
          }

//          console.log(s);
          if (msg.output.data[0].slice(input.length) == fin_gen_lol) {
//            socket.close();
//            done_with_genning = true;
//            break;
          }
          fin_gen_lol = msg.output.data[0].slice(input.length);
          final_prompt_lol = msg.output.data[0];
//          console.log(fin_gen_lol)
          if (fin_gen_lol.includes(end)) {
            socket.close();
            done_with_genning = true;
            break;
          }
/*          if (s.length > 0 && !started_end_str) {
            progressCallback(s);
          }*/
        } catch (e) {
          // lol
        }
        break;
      case "process_completed":
        try {
          fin_gen_lol = msg.output.data[0].slice(input.length);
          //          progressCallback("[DONE]");
        } catch (e) {
          // lol
        }
        socket.close();
        done_with_genning = true;
        break;
    }
  }

  const lol_do_it = () => new Promise(function(resolve, reject) {
    setInterval(function (resolve){
      if (done_with_genning) {
        resolve();
      }
    }, 100, resolve)
  });

  await lol_do_it();

  if (fin_gen_lol.includes(end)) {
    fin_gen_lol = fin_gen_lol.slice(0, fin_gen_lol.lastIndexOf(end))
  }

  if (fin_gen_lol.length === 0) {
    fin_gen_lol = "(empty output)";
  }

  socket.close();

  return fin_gen_lol.trim();
}

async function send_message(txt, thread_id) {
  input_text = gen_input_text();
  assistant_input_text = gen_assistant_input_text();

  if (!(thread_id in threads)) {
    reset(thread_id)
  }

  threads[thread_id] += input_text + txt + "\n" + assistant_input_text;
  tmp = await predict(threads[thread_id], max_tokens=10, temperature=0.7, top_p=0.01, top_k=40);
  tmp = (tmp.slice(threads[thread_id].length));
  threads[thread_id] += tmp + "\n";
  return tmp;
}

async function send_message_stream(txt, thread_id, progressCallback) {
  input_text = gen_input_text();
  assistant_input_text = gen_assistant_input_text();

  if (!(thread_id in threads)) {
    reset(thread_id)
  }

  threads[thread_id] += input_text + txt + "\n" + assistant_input_text;
  tmp = await predict_stream(threads[thread_id], progressCallback, max_tokens=1720, temperature=1.2, top_p=0.9, top_k=40);
//  tmp = (tmp.slice(threads[thread_id].length));
  threads[thread_id] += tmp + "\n";
  return tmp;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generate_history(conversationId) {
  var ret = "";

  var msgs = await getMessages({ conversationId });

  ret += gen_prompt();

  for (msg in msgs) {
    msg = msgs[msg];
    if (msg.sender == "User") {
      ret += gen_input_text();
      ret += msg.text;
      ret += "\n";
    } else if (msg.sender == "Vicuna") {
      ret += gen_assistant_input_text();
      ret += " ";
      ret += msg.text;
      ret += "\n";
    }
  }

  return ret;
}

async function generate_title(conversationId) {
  var history = await generate_history(conversationId);
  var prompt = history + "\n" + "### Human: Summarize this conversation in 5 words or less.\n### Assistant:"

  console.log(prompt);

  var title = await predict_stream(prompt, function (){}, 50, temperature=0.7);

  console.log(title);

  return title;
}

const askVicuna = async ({
  text,
  parentMessageId,
  conversationId,
  onProgress,
  abortController
}) => {
//  if (!!convo.parentMessageId && !!convo.conversationId) {
//    options = { ...options, ...convo };
//  }
/*  if (!!parentMessageId && !!conversationId) {
    var lolId = conversationId;
    var lolId2 = parentMessageId;
  } else {
    var lolId = crypto.randomUUID();
    var lolId2 = crypto.randomUUID();
  }*/


  var prompt = await generate_history(conversationId);
  threads[conversationId] = prompt;

  var rlol = await send_message_stream(text, conversationId, onProgress);

  var title = await generate_title(conversationId);

//  console.log(title);


//var rlol = "piss";

  const returnData = {
    id: crypto.randomUUID(),
    response: rlol,
    text: rlol,
//    response: "a",
    conversationId: undefined,
    parentMessageId: undefined,
    messageId: crypto.randomUUID(),
    details: {title: title}
  };

//  console.log(prompt);

  const res = returnData;
  return res;
};

module.exports = { askVicuna };
