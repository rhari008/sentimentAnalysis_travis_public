// (c) 2016 SAP SE
// Preinstall script to import binaries if required
var fs = require('fs');
var child_process = require('child_process');
var script_name = 'copy_binaries.sh';

if (fs.existsSync(script_name)) {
    var exec = require('child_process').exec;
    child_process.exec('/bin/bash ' + script_name, function(error, stdout, stderr) {
        console.log(stderr);
        console.log(stdout);
        if (error !== null) {
            process.exit(error.code);
        }
        fs.unlinkSync(script_name);
    });
}
