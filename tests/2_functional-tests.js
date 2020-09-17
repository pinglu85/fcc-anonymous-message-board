/*
 *
 *
 *       FILL IN EACH FUNCTIONAL TEST BELOW COMPLETELY
 *       -----[Keep the tests in the same order!]-----
 *       (if additional are added, keep them at the very end!)
 */

const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const server = require('../server');

const THREAD_URL = '/api/threads/mochatest';
const THREAD_ID_FOR_THREAD = '5f63a1a8aa5f6c70ac681936';

const REPLY_URL = '/api/replies/mochatest';
const THREAD_ID_FOR_REPLY = '5f63a0f4e891897a598d3ff1';
const REPLY_ID = '5f63a1a8aa5f6c70ac68193a';

const DELETE_PASSWORD = 'delete';
const INCORRECT_DELETE_PASSWORD = 'incorrect';

chai.use(chaiHttp);

suiteSetup((done) => {
  server.on('ready', () => {
    done();
  });
});

suite('Functional Tests', function () {
  suite('API ROUTING FOR /api/threads/:board', function () {
    test('POST a thread to a specific message board', function (done) {
      chai
        .request(server)
        .post(THREAD_URL)
        .send({
          text: 'mocha test: post a thread',
          delete_password: 'delete',
        })
        .end((err, res) => {
          expect(res).to.redirect;
          done();
        });
    });

    test('GET the most recent 10 bumped threads on the board with only the most recent 3 replies', function (done) {
      chai
        .request(server)
        .get(THREAD_URL)
        .end((err, res) => {
          const threads = res.body;
          assert.equal(res.status, 200);
          assert.isArray(threads);
          assert.isTrue(threads.length <= 10);
          threads.forEach((thread) => {
            assert.isObject(thread);
            assert.hasAllKeys(thread, [
              '_id',
              'text',
              'created_on',
              'bumped_on',
              'replies',
              'replycount',
            ]);
            assert.isString(thread._id);
            assert.isString(thread.text);
            assert.isArray(thread.replies);
            assert.isTrue(thread.replies.length <= 3);
            assert.isNumber(thread.replycount);
          });
          done();
        });
    });

    test('PUT: update the report value of a thread to true ', function (done) {
      chai
        .request(server)
        .put(THREAD_URL)
        .send({ thread_id: THREAD_ID_FOR_THREAD })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.text, 'success');
          done();
        });
    });

    test('DELETE a thread completely with incorrect delete_password', function (done) {
      chai
        .request(server)
        .delete(THREAD_URL)
        .send({
          thread_id: THREAD_ID_FOR_THREAD,
          delete_password: INCORRECT_DELETE_PASSWORD,
        })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.text, 'incorrect password');
          done();
        });
    });

    test('DELETE a thread completely with correct delete_password', function (done) {
      chai
        .request(server)
        .delete(THREAD_URL)
        .send({
          thread_id: THREAD_ID_FOR_THREAD,
          delete_password: DELETE_PASSWORD,
        })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.text, 'success');
          done();
        });
    });
  });

  suite('API ROUTING FOR /api/replies/:board', function () {
    test('POST a reply to a thead on a specific board', function (done) {
      chai
        .request(server)
        .post(REPLY_URL)
        .send({
          thread_id: THREAD_ID_FOR_REPLY,
          delete_password: 'delete',
          text: 'reply from mocha/chai',
        })
        .end((err, res) => {
          expect(res).to.redirect;
          done();
        });
    });

    /*
      {
        "_id": "5f5e3a237ac019003a160287",
        "text": "from insomnia",
        "created_on": "2020-09-13T15:26:26.852Z",
        "bumped_on": "2020-09-13T23:20:15.224Z",
        "replies": [
          {
            "_id": "5f5ea92e2cb07a003a34602f",
            "text": "reply from insomnia",
            "created_on": "2020-09-13T23:20:14.857Z",
          }
        ]
      }
    */
    test("GET an entire thread with all it's replies", function (done) {
      chai
        .request(server)
        .get(REPLY_URL)
        .query({ thread_id: THREAD_ID_FOR_REPLY })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.isObject(res.body);
          assert.hasAllKeys(res.body, [
            '_id',
            'text',
            'created_on',
            'bumped_on',
            'replies',
          ]);
          const replies = res.body.replies;
          assert.isArray(replies);
          if (replies.length) {
            assert.isObject(replies[0]);
            assert.hasAllKeys(replies[0], ['_id', 'text', 'created_on']);
          }
          done();
        });
    });

    test('PUT: update the report value of a reply to true', function (done) {
      chai
        .request(server)
        .put(REPLY_URL)
        .send({ thread_id: THREAD_ID_FOR_REPLY, reply_id: REPLY_ID })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.text, 'success');
          done();
        });
    });

    test('DELETE a reply with incorrect delete_password', function (done) {
      chai
        .request(server)
        .delete(REPLY_URL)
        .send({
          thread_id: THREAD_ID_FOR_REPLY,
          reply_id: REPLY_ID,
          delete_password: INCORRECT_DELETE_PASSWORD,
        })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.text, 'incorrect password');
          done();
        });
    });

    test('DELETE a reply with correct password', function (done) {
      chai
        .request(server)
        .delete(REPLY_URL)
        .send({
          thread_id: THREAD_ID_FOR_REPLY,
          reply_id: REPLY_ID,
          delete_password: DELETE_PASSWORD,
        })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.text, 'success');
          done();
        });
    });
  });
});
