/* eslint-env jest */
const mockValidate = jest.fn((msg, callback) => {
  if (msg.Type === 'SubscriptionConfirmation' || msg.Type === 'UnsubscribeConfirmation') {
    return callback(null, {
      Type: msg.Type,
      SubscribeURL: 'https://bla.com',
    });
  }
  if (msg.Type === 'Notification') {
    return callback(null, {
      Type: 'Notification',
      Message: JSON.stringify({ hello: 'world' }),
    });
  }
  if (msg.Type === 'NotificationMalformed') {
    return callback(null, {
      Type: 'Notification',
      Message: JSON.stringify(),
    });
  }
  return callback(Error('Error: Message missing required keys.'), 'error');
});

const MessageValidator = jest.fn().mockImplementation(() => ({
  validate: mockValidate,
}));

module.exports = MessageValidator;
