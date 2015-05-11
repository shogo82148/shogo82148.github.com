#!/bin/sh

STATUS=`git status --short`
if [ -n "STATUS" ]; then
    echo "コミットされていない変更があります！"
    exit 1
fi

echo "反映するよ！！"

git push origin source && bundle exec rake gen_deloy
