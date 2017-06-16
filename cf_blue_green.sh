#!/bin/bash

# Blue-green deployment script. Usage:
#
#   ./cf-blue-green <appname>

set -e
set -o pipefail
set -x


if [ $# -eq 0 ]; then
	echo "Usage:\n\n\t./cf-blue-green <appname>\n"
	exit 1
fi

CURRENTPATH=$(pwd)

#sudo apt-get install make
#curl https://www.openssl.org/source/openssl-1.0.2g.tar.gz | tar xz && cd openssl-1.0.2g && sudo ./config && sudo make && sudo make install
#sudo ln -sf /usr/local/ssl/bin/openssl 'which openssl'

#export PATH=/usr/local/ssl/bin:$PATH

#curl --version
###########
#cd $CURRENTPATH
#sudo apt-get remove curl
#sudo mkdir /usr/bin/curl
#sudo cp $CURRENTPATH/Library/curl.tar.gz /usr/bin/curl/curl.tar.gz
#cd /usr/bin/curl
#tar -xvzf curl.tar.gz
#sudo rm *.gz
#ls -ltr
#cd curl-7.54.0
#sudo ./configure --with-ssl=/usr/local/ssl/bin --libdir=/usr/lib/x86_64-linux-gnu #=/usr/lib/openssl/lib
#sudo make
#sudo make install
#sudo ldconfig
#export PATH=$PATH:/usr/bin/curl/curl-7.54.0
#curl --version
###########
#curl --fail -I -k "https://sentimentAnalysisi048564-B.cfapps.us20.hana.ondemand.com"

BLUE=$1
GREEN="${BLUE}-B"

BLUE2=$2 #Mainly for app router
GREEN2="${BLUE2}-B"

finally ()
{
  # we don't want to keep the sensitive information around
  rm $MANIFEST
}

on_fail () {
  finally
  echo "DEPLOY FAILED - you may need to check 'cf apps' and 'cf routes' and do manual cleanup"
}

# Change the details in the manifest file
# Change the application names, the host and the URLs

# pull the up-to-date manifest from the BLUE (existing) application
MANIFEST=$(mktemp -t "${BLUE}_manifest.XXXXXXXXXX")
#cf create-app-manifest $BLUE -p $MANIFEST  -- Use this ONLY when there is just one app

#more $MANIFEST

sudo cp manifest.yml $MANIFEST


sudo sed -i -e "s/: ${BLUE}/: ${GREEN}/g" $MANIFEST # Used for main app
sudo sed -i -e "s/: ${BLUE2}/: ${GREEN2}/g" $MANIFEST # Used for app router

sudo sed -i -e "s?path: ?path: $CURRENTPATH/?g" $MANIFEST # Used for path changes


# set up try/catch
# http://stackoverflow.com/a/185900/358804
trap on_fail ERR

DOMAIN="cfapps.us20.hana.ondemand.com" #  ${B_DOMAIN:-$(cat $MANIFEST | grep domain: | awk '{print $2}')}

# create the GREEN application
#cf push $GREEN -f $MANIFEST -n $GREEN  - Use this for single app push

cf push -f $MANIFEST

#https://curl.haxx.se/download/curl-7.54.0.tar.gz
#sudo wget https://curl.haxx.se/download/curl-7.54.0.tar.gz --no-check-certificate --secure-protocol=tlsv1

# ensure it starts
#ch=curl_init();
#curl_setopt($ch, CURLOPT_SSLVERSION, 3);

#curl -2 -I "https://${GREEN}.${DOMAIN}" 
#curl -3 -I "https://${GREEN}.${DOMAIN}" 
url="\"https://${GREEN}.${DOMAIN}\""
echo $url

curl --version
curl --fail -I -k https://sentimentAnalysisi048564-B.cfapps.us20.hana.ondemand.com #--tlsv1 

# add the GREEN application to each BLUE route to be load-balanced
# TODO this output parsing seems a bit fragile...find a way to use more structured output
cf routes | tail -n +4 | grep $BLUE | awk '{print $3" -n "$2}' | xargs -n 3 cf map-route $GREEN

#For the second application
cf routes | tail -n +4 | grep $BLUE2 | awk '{print $3" -n "$2}' | xargs -n 3 cf map-route $GREEN2

# cleanup
# TODO consider 'stop'-ing the BLUE instead of deleting it, so that depedencies are cached for next time
cf delete $BLUE -f
cf delete $BLUE2 -f
cf rename $GREEN $BLUE
cf rename $GREEN2 $BLUE2
cf delete-route $DOMAIN -n $GREEN -f
cf delete-route $DOMAIN -n $GREEN2 -f
finally

echo "DONE"