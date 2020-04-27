
const AWS = require('aws-sdk');

const server = Hapi.server({
  host: 'localhost',
  port: 8000
});

server.route({
  method: 'POST',
  path: '/work',
  handler: async (request, h) => {

    const json = request.payload();
    console.log(json);
    
    const sqs = new AWS.SQS({
        region: 'eu-west-1'
    });

    const q = await sqs.createQueue({
        QueueName: 'my_amazing_queue.fifo',
        Attributes: {
            FifoQueue: "true"
        }
    }).promise();

    return 'Hello World!';
  }
});

async function start () {
  try {
    await server.start();
  }
  catch (err) {
    console.log(err);
    process.exit(1);
  }
  console.log('Server running at:', server.info.uri);
};

start();