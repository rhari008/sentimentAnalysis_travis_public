'use strict';

var assert = require('assert');

var Logs = require('./Logs');

module.exports = Schedule;

function Schedule(scheduler, description, parameter, xscron, active, jobId, scheduleId) {
  assert(scheduler, 'Missing scheduler');
  assert(scheduleId, ' Missing scheduleId');
  assert(jobId, 'Missing jobId');

  Object.defineProperty(this, 'description', {
    enumerable: true,
    get: function () {
      return description;
    },
    set: function (value) {
      if (typeof value !== 'string') {
        throw new Error('Incorrect type for "description"');
      }
      scheduler.sync.updateJobSchedule({
        jobId: jobId,
        scheduleId: scheduleId,
        schedule: {
          description: value
        }
      });
      description = value;
    }
  });
  Object.defineProperty(this, 'active', {
    enumerable: true,
    get: function () {
      return active;
    },
    set: function (value) {
      if (typeof value !== 'boolean') {
        throw new Error('Incorrect type for "Active"');
      }
      scheduler.sync.updateJobSchedule({
        jobId: jobId,
        scheduleId: scheduleId,
        schedule: {
          active: value
        }
      });
      active = value;
    }
  });
  Object.defineProperty(this, 'parameter', {
    enumerable: true,
    get: function () {
      return parameter;
    },
    set: function (value) {
      if (typeof value !== 'string' && typeof value !== 'object') {
        throw new Error('Incorrect type for "parameter"');
      }
      scheduler.sync.updateJobSchedule({
        jobId: jobId,
        scheduleId: scheduleId,
        schedule: {
          data: (typeof value === 'string') ? JSON.parse(value) : value
        }
      });
      parameter = value;
    }
  });
  Object.defineProperty(this, 'xscron', {
    enumerable: true,
    get: function () {
      return xscron;
    },
    set: function (value) {
      if (typeof value !== 'string') {
        throw new Error('Incorrect type for "xscron"');
      }
      scheduler.sync.updateJobSchedule({
        jobId: jobId,
        scheduleId: scheduleId,
        schedule: {
          cron: value
        }
      });
      xscron = value;
    }
  });

  Object.defineProperty(this, 'logs', {
    enumerable: true,
    get: function () {
      return new Logs(scheduler, scheduleId, jobId);
    }
  });
}
