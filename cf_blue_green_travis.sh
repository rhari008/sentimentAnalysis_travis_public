#!/bin/bash

set -e

# Use the URL to a Debian 64 bit installer select from here:
# https://github.com/cloudfoundry/cli/releases
# This is the source file after following the redirect
#wget https://s3.amazonaws.com/go-cli/releases/v6.26.0/cf-cli_amd64.deb -qO temp.deb && sudo dpkg -i temp.deb
#wget https://cli.run.pivotal.io/stable?release=debian64&version=6.26.0&source=github-rel -qO temp.deb && sudo dpkg -i temp.deb
#rm temp.deb

# ...first add the Cloud Foundry Foundation public key and package repository to your system
wget -q -O - https://packages.cloudfoundry.org/debian/cli.cloudfoundry.org.key | sudo apt-key add -
echo "deb http://packages.cloudfoundry.org/debian stable main" | sudo tee /etc/apt/sources.list.d/cloudfoundry-cli.list
# ...then, update your local package index, then finally install the cf CLI
sudo apt-get update
sudo apt-get install cf-cli

echo $CF_API
echo $CF_ORGANIZATION
echo $CF_SPACE
echo $CF_USERNAME
echo $CF_PASSWORD

cf api $CF_API
cf login -u $CF_USERNAME -p $CF_PASSWORD -o $CF_ORGANIZATION -s $CF_SPACE

# Get path to script directory: http://stackoverflow.com/a/4774063
pushd `dirname $0` > /dev/null
SCRIPTPATH=`pwd`
popd > /dev/null

sudo $SCRIPTPATH/cf_blue_green.sh $CF_APP approuter #Pass the app names

cf logout