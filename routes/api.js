/*
 *
 *
 *       Complete the API routing below
 *
 *
 */

'use strict';
const ObjectId = require('mongodb').ObjectId;
const AppError = require('../utils/appError');
const writeConcern = {
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 1000,
  },
};

module.exports = function (app, db) {
  // Thread api
  app
    .route('/api/threads/:board')
    // Get he most recent 10 bumped threads on the board
    // with only the most recent 3 replies, and exclude the
    // reported and delete_passwords fields from both thread
    // object and every reply object in the replies array.
    .get(async (req, res, next) => {
      const { board } = req.params;
      const aggregation = [
        // Get the count of replies and add the replycount field
        // to the thread document.
        { $addFields: { replycount: { $size: '$replies' } } },
        // Deconstruct the replies array, so that we can sort replies by date.
        { $unwind: { path: '$replies', preserveNullAndEmptyArrays: true } },
        // Sort replies by created date in descending order.
        { $sort: { 'replies.created_on': -1 } },
        // Group them back on _id.
        {
          $group: {
            _id: '$_id',
            text: { $first: '$text' },
            created_on: { $first: '$created_on' },
            bumped_on: { $first: '$bumped_on' },
            replies: {
              // Push reply object to the replies array.
              $push: {
                $cond: [
                  // If the replies array is not empty, ...
                  { $gt: ['$replycount', 0] },
                  // ...then the reply object has _id, text and created_on fields,
                  // the reported and delete_passwords fields are excluded.
                  {
                    _id: '$replies._id',
                    text: '$replies.text',
                    created_on: '$replies.created_on',
                  },
                  // otherwise exclude the reply object
                  // so as to avoid pushing empty object
                  // into the replies array when replies
                  // is empty.
                  '$$REMOVE',
                ],
              },
            },
            replycount: { $first: '$replycount' },
          },
        },
        // Use $project to take only the first 3 replies
        // from the accumulated replies array of each doc.
        {
          $project: {
            _id: 1,
            text: 1,
            created_on: 1,
            bumped_on: 1,
            replies: { $slice: ['$replies', 3] },
            replycount: 1,
          },
        },
        // Sort the thread document by date in descending order.
        { $sort: { bumped_on: -1 } },
        // Return only the first 10 thread.
        {
          $limit: 10,
        },
      ];

      try {
        const result = await db
          .collection(board)
          .aggregate(aggregation)
          .toArray();
        res.json(result);
      } catch (err) {
        next(err);
      }
    })
    // Post a new thread.
    .post(async (req, res, next) => {
      const { board } = req.params;
      const { text, delete_password } = req.body;
      const date = new Date();
      const newThread = {
        _id: ObjectId(),
        text: text,
        created_on: date,
        bumped_on: date,
        reported: false,
        delete_password: delete_password,
        replies: [],
      };
      try {
        await db.collection(board).insertOne(newThread, writeConcern);
        res.redirect(`/b/${board}/`);
      } catch (err) {
        next(err);
      }
    })
    // Delete a thread.
    .delete(async (req, res, next) => {
      const { board } = req.params;
      const { thread_id, delete_password } = req.body;
      const filter = { _id: ObjectId(thread_id) };
      try {
        // Find the thread in the board.
        const thread = await db.collection(board).findOne(filter);
        if (!thread) {
          throw new AppError(400, 'Thread not found.');
        }
        let message;
        // Compare the delete_password with the one returned from the database.
        // If they don't match, send 'incorrect password'.
        if (delete_password !== thread.delete_password) {
          message = 'incorrect password';
        } else {
          // Otherwise, delete the thread from the board,
          // then send text response 'success'.
          const { deletedCount } = await db
            .collection(board)
            .deleteOne(filter, writeConcern);
          if (deletedCount === 1) {
            message = 'success';
          } else {
            throw new AppError(
              500,
              `Could not delete thread with id: ${thread_id}`
            );
          }
        }
        res.type('txt').send(message);
      } catch (err) {
        console.log(err);
        next(err);
      }
    })
    // Report a thread.
    .put(async (req, res, next) => {
      const { board } = req.params;
      const { thread_id } = req.body;
      const filter = { _id: ObjectId(thread_id) };
      const update = { $set: { reported: true } };
      try {
        // Find the thread and update its reported to true.
        const { value } = await db
          .collection(board)
          .findOneAndUpdate(filter, update, writeConcern);
        // If the operation is successful, send text response 'success'.
        if (value) {
          res.type('txt').send('success');
        } else {
          // Otherwise throw a new error (`Failed to report thread_id: ${thread_id}`)
          throw new AppError(
            400,
            `Failed to report thread with id: ${thread_id}`
          );
        }
      } catch (err) {
        next(err);
      }
    });

  // Reply api
  app
    .route('/api/replies/:board')
    // Get an entire thread with all its replies.
    .get(async (req, res, next) => {
      const { board } = req.params;
      const { thread_id } = req.query;

      // Exclude the reported and delete_passwords fields from
      // both thread object and each reply object in the replies array.
      const aggregation = [
        // Pass only the document that match
        // the thread_id to the next pipeline stage.
        { $match: { _id: ObjectId(thread_id) } },
        // Get the count of replies and add the replycount field
        // to the thread document.
        { $addFields: { replycount: { $size: '$replies' } } },
        // Deconstruct the replies array, so that we can sort replies by date.
        { $unwind: { path: '$replies', preserveNullAndEmptyArrays: true } },
        // Group them back on _id.
        {
          $group: {
            _id: '$_id',
            text: { $first: '$text' },
            created_on: { $first: '$created_on' },
            bumped_on: { $first: '$bumped_on' },
            replies: {
              // Push reply object to the replies array.
              $push: {
                $cond: [
                  // If the replies array is not empty, ...
                  { $gt: ['$replycount', 0] },
                  // ...then the reply object has _id, text and created_on fields,
                  // the reported and delete_passwords fields are excluded.
                  {
                    _id: '$replies._id',
                    text: '$replies.text',
                    created_on: '$replies.created_on',
                  },
                  // otherwise exclude the reply object
                  // so as to avoid pushing empty object
                  // into the replies array when replies
                  // is empty.
                  '$$REMOVE',
                ],
              },
            },
          },
        },
      ];
      try {
        // Find the thread in the board and returned with be all fields
        // excluding reported and delete_password; the same fields in
        // every reply object in replies array are also excluded.
        const thread = await db
          .collection(board)
          .aggregate(aggregation)
          .toArray();
        // If the operation is successful, send the thread to the frontend.
        if (thread.length) {
          res.json(thread[0]);
        } else {
          // Otherwise throw new error (`Failed to fetch thread_id: ${thread_id}`)
          throw new AppError(
            400,
            `Failed to fetch thread with id: ${thread_id}`
          );
        }
      } catch (err) {
        next(err);
      }
    })
    // Post a new reply to a thread.
    .post(async (req, res, next) => {
      const { board } = req.params;
      const { text, delete_password, thread_id } = req.body;

      const date = new Date();
      const filter = { _id: ObjectId(thread_id) };
      const update = {
        // Update the bumped_on field.
        $set: { bumped_on: date },
        // Append a new reply to the replies array
        $push: {
          replies: {
            _id: ObjectId(),
            text: text,
            created_on: date,
            reported: false,
            delete_password: delete_password,
          },
        },
      };

      try {
        const { value } = await db
          .collection(board)
          .findOneAndUpdate(filter, update, writeConcern);

        // If the operation is successful, redirect
        // to thread page '/b/{board}/{thread_id}'
        if (value) {
          res.redirect(`/b/${board}/${thread_id}`);
        } else {
          throw new AppError(
            400,
            `Failed to post new reply to thread with id: ${thread_id}`
          );
        }
      } catch (err) {
        next(err);
      }
    })
    // Delete a reply from a thread.
    .delete(async (req, res, next) => {
      const { board } = req.params;
      const { thread_id, reply_id, delete_password } = req.body;

      const filter = {
        _id: ObjectId(thread_id),
        'replies._id': { $eq: ObjectId(reply_id) },
      };

      try {
        // Find the thread in the board using thread_id and reply_id.
        const thread = await db.collection(board).findOne(filter);

        if (!thread) {
          return res.type('txt').send('Incorrect thread_id or reply_id');
        }

        let replyMessage;

        // Find the delete_password of the corresponding
        // reply in the replies array.
        const replyDeletePassword = thread.replies.find(
          (reply) => String(reply._id) === reply_id
        ).delete_password;

        // Compare the delete_password with the one returned from
        // the database. If they don't match, set replyMessage to
        // 'incorrect password'.
        if (delete_password !== replyDeletePassword) {
          replyMessage = 'incorrect password';
        } else {
          // Set the text of reply document to '[deleted]'.
          const update = {
            $set: { 'replies.$[elem].text': '[deleted]' },
          };
          // Change the text of the specific reply.
          const { modifiedCount } = await db
            .collection(board)
            .updateOne(filter, update, {
              ...writeConcern,
              // arrayFilters determines which array elements to modify
              // for an update operation on an array field. Here only the
              // reply whose _id is equal to reply_id will be updated.
              arrayFilters: [{ 'elem._id': { $eq: ObjectId(reply_id) } }],
            });

          if (modifiedCount) {
            replyMessage = 'success';
          } else if (modifiedCount === 0) {
            replyMessage = 'Reply is already deleted.';
          }
        }

        res.type('txt').send(replyMessage);
      } catch (err) {
        next(err);
      }
    })
    // Report a reply.
    .put(async (req, res, next) => {
      const { board } = req.params;
      const { thread_id, reply_id } = req.body;

      // Find the thread using thread_id and reply_id.
      // The replies array of the thread should contain an embedded
      // document whose _id equals reply_id.
      const filter = {
        _id: ObjectId(thread_id),
        'replies._id': { $eq: ObjectId(reply_id) },
      };
      const update = { $set: { 'replies.$[elem].reported': true } };
      const arrayFilters = [{ 'elem._id': { $eq: ObjectId(reply_id) } }];

      try {
        // Find the reply and change its reported field to 'true'.
        const { value } = await db
          .collection(board)
          .findOneAndUpdate(filter, update, { ...writeConcern, arrayFilters });

        let replyMessage;

        if (value) {
          replyMessage = 'success';
        } else {
          replyMessage = 'Incorrect thread_id or reply_id';
        }

        res.type('txt').send(replyMessage);
      } catch (err) {
        next(err);
      }
    });
};
