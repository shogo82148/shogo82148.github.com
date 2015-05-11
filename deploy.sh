#!/bin/sh

if [[ -n `git status --short` ]]; then
    echo "コミットされていない変更があります！"
    exit 1
fi

echo "反映するよ！！"

git push origin source && bundle exec rake gen_deloy
