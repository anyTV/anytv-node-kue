# anytv-kue

Kue Helper for setup and cleanup of Kue

# Changes to be made to old codes
===

1. Replace all `require('kue');` with

    ```javascript
        const kue = require('anytv-kue')(config);
    ```

# Added features
===
- Setup kue

    ```javascript
    // server.js (before)
    const kue = require('kue')

    function start () {
        /* server code */
    }

    queue.on('error', err => {
        winston.log('error', 'QUEUE ERROR:', err);
    });

    process.once('SIGTERM', sig => {
        winston.log('SIGTERM', sig);
        queue.shutdown(5000, err => {
            winston.log('error', 'Kue shutdown:', err );
            process.exit(0);
        });
    });

    queue.active((err, ids) => {
        ids.forEach(id => {
            kue.Job.get(id, (_err, job) => {
                job.inactive();
            });
        });
    });

    queue.inactive((err, ids) => {
        ids.forEach(id => {
            kue.Job.get(id, (_err, job) => {
                job.inactive();
            });
        });
    });

    start();

    ```
    ```javascript
    // server.js (now)
    const kue = require('antv-kue')();

    function start () {
        /* server code */
    }

    kue.setup();

    start();

    ```
- Activate UI
    ```
        const kue = require('anytv-kue')({removeOnComplete:false});
        const queue = kue.createQueue();
        const express = require('express');
        const app = express();

        //activates UI without auth in `/kue`
        kue.activateUI(app)();
        //activates UI in route `/kueapp` without auth
        kue.activateUI(app)('/kueapp')
        //activates UI with basic auth in `/kue`
        kue.activateUI(app, 'username', 'password')();
        //activates UI with basic auth in `/kueapp`
        kue.activateUI(app, 'username', 'password')('/kueapp');
        //activates UI with custom middleware in `/kue`
        kue.activateUI(app, middleWare)();
        //activates UI with custom middleware in `/kueapp`
        kue.activateUI(app, middleWare)('/kueapp');


    ```
- Cleanup jobs

    ```javascript
      kue.cleanup(job_type, status);
    ```

- Remove jobs on complete
    ```javascript
      // before
      const kue = require('kue');
      const queue = kue.createQueue();

      queue.create('name', {})
        .removeOnComplete(true)
        .save()

      queue.create('name2', {})
        .removeOnComplete(true)
        .save()
    ```
    ```javascript
      //now
      const kue = require('anytv-kue')({removeOnComplete: true});
      const queue = kue.createQueue();

      queue.create('name', {})
        .save()

      queue.create('name2', {})
        .save()
    ```

# Available configurations

## constructor
- `removeOnComplete` - will Kue remove data from redis when job is complete
- `shutdownTimer` - time alotted for graceful shutdown

## setup

```javascript
kue.setup(queue, callbacks);
```

- `queue` - the queue we want to listen to (usually the return of `kue.createQueue`)
- `callbacks` - there are 5 callbacks available
    ```javascript
    {
      //called when there is an error in redis queue
      error: function (err) {

      },

      //called when a job failed altogethere after alotted attempts
      failed: function (jobid) {

      },

      //called when a process SIGTERM occurs
      sigterm: function (sig) {

      },

      //called upon setup, control what you want to do with active jobs
      active: function (err, ids) {

      },

      //called upon setup, control what you want to do with inactive jobs
      inactive: function (err, ids) {

      }
    }
    ```
