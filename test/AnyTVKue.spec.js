'use strict';

const sinon = require('sinon');

const AnyTVKue = require('../lib/AnyTVKue').default;
const sandbox = sinon.createSandbox();

/**
 * @test {AnyTVKue}
 */
describe('#AnyTVKue', function () {

    afterEach(function () {
        sandbox.restore();
    });

    /**
     * @test {AnyTVKue#constructor}
     */
    it('creates an instance of AnyTVKue', function () {

        const inst = new AnyTVKue();

        inst.should.be.an.instanceOf(AnyTVKue);
    });

    /**
     * @test {AnyTVKue#createQueue}
     */
    describe('#createQueue', function () {

        it('creates custom kue.create function', function () {

            const inst = new AnyTVKue();
            const queue = inst.createQueue();

            queue.create.isCustom.should.equal(true);
        });

        it('removes jobs on complete by default', function () {

            const inst = new AnyTVKue();
            const queue = inst.createQueue();
            const job = {
                type: 'test_job',
                data: {
                    a: 1
                }
            };

            const testJob = queue.create(job.type, job.data);
            const stub = sandbox.stub(testJob, 'removeOnComplete');
            testJob.save();

            stub.calledWith(true).should.equal(true);
        });

        // https://github.com/anyTV/anytv-node-kue/issues/2
        // https://freedom.myjetbrains.com/youtrack/issue/Delta-62
        it('does not remove completed jobs when remove_on_complete is set to false', function () {

            const inst = new AnyTVKue({
                remove_on_complete: false
            });
            const queue = inst.createQueue();
            const job = {
                type: 'test_job',
                data: {
                    a: 1
                }
            };

            const testJob = queue.create(job.type, job.data);
            const stub = sandbox.stub(testJob, 'removeOnComplete');
            testJob.save();

            stub.calledWith(false).should.equal(true);

            queue.cleanup('test_job');
        });

        describe('#createJob', function () {

            it('jobs should support a fixed custom doubling backoff that starts at 2 minutes', function () {
                const inst = new AnyTVKue();
                const queue = inst.createQueue();
                const data = {
                    a: 1
                };

                const testJob = queue.createJob('test_job', data)
                    .backoff('fixed_doubling');

                testJob._backoff(0).should.equal(1000 * 60);
            });

            it('jobs should support a custom doubling backoff based on previous attempt\'s delay', function () {
                const inst = new AnyTVKue();
                const queue = inst.createQueue();
                const data = {
                    a: 1
                };

                const testJob = queue.createJob('test_job', data)
                    .backoff('delay_doubling');

                testJob._backoff(1, 2000).should.equal(4000);
            });

            it('custom delay-based doubling backoff should default to 2 seconds when no initial delay', function () {
                const inst = new AnyTVKue();
                const queue = inst.createQueue();
                const data = {
                    a: 1
                };

                const testJob = queue.createJob('test_job', data)
                    .backoff('delay_doubling');

                testJob._backoff(1, 0).should.equal(2000);
            });

        });

    });

    /**
     * @test {AnyTVKue#activateUI}
     */
    describe('#activateUI', function () {

        it('should throw error when called without the required arguments', function () {

            const inst = new AnyTVKue();

            inst.activateUI.bind(inst, undefined).should.throw();
            inst.activateUI.bind(inst, null).should.throw();
        });

        it('should throw error when called with invalid argument', function () {

            const inst = new AnyTVKue();

            inst.activateUI.bind(inst, {}).should.throw();
        });
    });

    /**
     * @test {AnyTVKue#setup}
     */
    describe('#setup', function () {

        it('should bind error listeners', function () {

            const inst = new AnyTVKue();
            const queue = inst.createQueue();

            const errorSpy = sandbox.spy();
            const failedSpy = sandbox.spy();

            inst.setup(queue, {
                error: errorSpy,
                failed: failedSpy
            });

            queue.emit('error');
            errorSpy.calledOnce.should.equal(true);

            queue.emit('job failed');
            failedSpy.calledOnce.should.equal(true);
        });
    });
});
