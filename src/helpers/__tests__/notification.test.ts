import { describe, expect, it } from 'vitest';
import { parseNotification } from '@/helpers/notification';

// Фикстура по формату skill green-api §4, данные фейковые.
function textNotification(overrides: Record<string, unknown> = {}) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 1101000000, wid: '79991234567@c.us', typeInstance: 'v3' },
    timestamp: 1763115112,
    idMessage: '1763115112345',
    senderData: {
      chatId: '10000000',
      chatType: 'user',
      sender: '10000000',
      senderName: 'Собеседник',
    },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет!' } },
    ...overrides,
  };
}

describe('parseNotification', () => {
  it('incomingMessageReceived с textMessage → входящее, timestamp в миллисекундах', () => {
    expect(parseNotification(textNotification())).toEqual({
      idMessage: '1763115112345',
      chatId: '10000000',
      text: 'Привет!',
      direction: 'incoming',
      timestamp: 1763115112000,
    });
  });

  it.each(['outgoingMessageReceived', 'outgoingAPIMessageReceived'])(
    '%s → исходящее',
    (typeWebhook) => {
      expect(parseNotification(textNotification({ typeWebhook }))).toMatchObject({
        direction: 'outgoing',
        chatId: '10000000',
        text: 'Привет!',
      });
    },
  );

  it('extendedTextMessage → текст из extendedTextMessageData.text', () => {
    const body = textNotification({
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'Смотри https://max.ru' },
      },
    });

    expect(parseNotification(body)).toMatchObject({ text: 'Смотри https://max.ru' });
  });

  it('числовой senderData.chatId приводит к строке', () => {
    const body = textNotification({ senderData: { chatId: 10000000 } });

    expect(parseNotification(body)).toMatchObject({ chatId: '10000000' });
  });

  it('текст сообщения не меняет: пробелы и HTML остаются как есть', () => {
    const body = textNotification({
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: ' <b>x</b> ' } },
    });

    expect(parseNotification(body)).toMatchObject({ text: ' <b>x</b> ' });
  });

  it.each([
    ['stateInstanceChanged', { typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' }],
    [
      'outgoingMessageStatus',
      { typeWebhook: 'outgoingMessageStatus', idMessage: '1', timestamp: 1, status: 'read' },
    ],
    [
      'медиа (imageMessage)',
      textNotification({
        messageData: { typeMessage: 'imageMessage', fileMessageData: { downloadUrl: 'x' } },
      }),
    ],
    [
      'пустой текст',
      textNotification({
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: '   ' } },
      }),
    ],
    ['нет idMessage', textNotification({ idMessage: undefined })],
    ['нет timestamp', textNotification({ timestamp: undefined })],
    ['timestamp строкой', textNotification({ timestamp: '1763115112' })],
    ['нет senderData', textNotification({ senderData: undefined })],
    ['пустой chatId', textNotification({ senderData: { chatId: '' } })],
    ['нет messageData', textNotification({ messageData: undefined })],
    [
      'textMessageData не объект',
      textNotification({ messageData: { typeMessage: 'textMessage', textMessageData: 'x' } }),
    ],
    // Имена из Object.prototype не должны находиться как направление сообщения.
    ['typeWebhook toString', textNotification({ typeWebhook: 'toString' })],
    ['typeWebhook constructor', textNotification({ typeWebhook: 'constructor' })],
    ['typeWebhook __proto__', textNotification({ typeWebhook: '__proto__' })],
    ['typeWebhook hasOwnProperty', textNotification({ typeWebhook: 'hasOwnProperty' })],
    ['null', null],
    ['строка', 'incomingMessageReceived'],
    ['массив', []],
    ['пустой объект', {}],
  ])('%s → null без исключения', (_name, body) => {
    expect(parseNotification(body)).toBeNull();
  });
});
