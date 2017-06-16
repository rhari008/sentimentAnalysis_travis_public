'use strict';

var assert = require('assert');

module.exports = Logs;

function Logs(scheduler, scheduleId, jobId) {
  assert(scheduler, 'Missing scheduler');
  assert(scheduleId, ' Missing scheduleId');
  assert(jobId, 'Missing jobId');

  Object.defineProperty(this, 'scheduleId', {
    enumerable: false,
    value: scheduleId
  });
  Object.defineProperty(this, 'jobId', {
    enumerable: false,
    value: jobId
  });
  Object.defineProperty(this, 'jobLog', {
    enumerable: true,
    get: function () {
      var body = scheduler.sync.fetchJobSchedule({
        jobId: this.jobId,
        scheduleId: this.scheduleId,
        displayLogs: true
      });
      return body.logs.map(function (jlog) {
        var host = null;
        var port = null;
        return new JobLogObject(
          jlog.scheduleTime,
          jlog.status,
          jlog.status === 'ERROR' ? jlog.text : null,
          jlog.executionTime,
          jlog.completionTime,
          host,
          port,
          jlog.action,
          jlog.user,
          jlog.locale);
      });
    }
  });
}

function JobLogObject(plannedTime, status, errorMessage, startedAt, finishedAt, host, port, action, user, locale) {
  Object.defineProperty(this, 'planned_time', {
    enumerable: true,
    value: (plannedTime !== null && typeof plannedTime !== 'undefined') ? new Date(plannedTime) : null,
    writable: false
  });
  Object.defineProperty(this, 'status', {
    enumerable: true,
    value: status,
    writable: false
  });
  Object.defineProperty(this, 'error_message', {
    enumerable: true,
    value: errorMessage,
    writable: false
  });
  Object.defineProperty(this, 'started_at', {
    enumerable: true,
    value: (startedAt !== null && typeof startedAt !== 'undefined') ? new Date(startedAt) : null,
    writable: false
  });
  Object.defineProperty(this, 'finished_at', {
    enumerable: true,
    value: (finishedAt !== null && typeof finishedAt !== 'undefined') ? new Date(finishedAt) : null,
    writable: false
  });
  Object.defineProperty(this, 'host', {
    enumerable: true,
    value: host,
    writable: false
  });
  Object.defineProperty(this, 'port', {
    enumerable: true,
    value: port,
    writable: false
  });
  Object.defineProperty(this, 'action', {
    enumerable: true,
    value: action,
    writable: false
  });
  Object.defineProperty(this, 'user', {
    enumerable: true,
    value: user,
    writable: false
  });
  Object.defineProperty(this, 'locale', {
    enumerable: true,
    value: locale,
    writable: false
  });
}
