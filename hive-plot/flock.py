#!/usr/bin/env python
# encoding=utf8
"""
Seth Brown
sethbrown@drbunsen.org
07-04-12
Python 2.7.3
"""

import sys
from time import sleep
from itertools import chain
import requests
from requests.exceptions import ConnectionError
import ujson as json


def followers(query=sys.argv[1]):
    """ generator of (user_id, follower), ... """
    base_url = "https://api.twitter.com/1/followers/ids.json?user_id="
    f = requests.get(''.join((base_url, query))).json
    return ((str(query), str(i)) for i in f['ids'])

def user_names(ids):
    """ find usernames from an iterable of ids """
    def fractionate(it, n=10):
        return (it[i:i+n] for i in xrange(0, len(it), n))
    fractions = fractionate(ids)
    node_query = (','.join(iter(_)) for _ in fractions)
    base_url = 'http://api.twitter.com/1/users/lookup.json?user_id='
    urls = [''.join((base_url, i)) for i in node_query]
    try:
        d = (requests.get(i).json for i in urls)
        for i in d:
            for j in i:
                yield (j['id_str'], j['screen_name'])
    except TypeError:
        print 'You\'ve exceeded the number of \
        allowable API calls. Try again in 1 hour'


if __name__ == '__main__':
    # initialize edges: {my id : [my followers]}
    # my id = '14621493'
    edges = {}
    [edges.setdefault(i[0], []).append(i[1])
            for i in followers(sys.argv[1])]

    # [ids of my followers]
    uf = list(set(chain(*edges.values())))
    print 'uf length --->', len(uf)

    # id: mapped to user_names
    u = {k: v for k, v in user_names(uf)}
    print 'u length --->', len(u)

    # initialize hive plot data
    hive = []
    [hive.append({"name": n, "imports": []}) for n in u.values()]

    # constuct follower edges:
    # {my follower: [their followers who follow me]}
    f_edges = {}
    for f in uf:
        try:
            ff = followers(f)
            for i in ff:
                if i[1] in u:
                    f_edges.setdefault(f, []).append(i[1])
        # throttle api calls
        # append skipped user to end of the queue
        except ConnectionError:
            uf.append(f)
            sleep(1000)
        # skip private accounts
        except KeyError:
            pass

    for k, v in f_edges.items(): # all ids
        if k in u:
            name = u.get(k)
            imp = [u.get(i) for i in v if i in u]
            for i in hive:
                if i['name'] == name:
                    i['imports'] = imp
                    print i['name'], i['imports'], name, imp

    with open('hive-data.json', mode="w") as outfile:
        json_data = json.dumps(hive)
        outfile.write(json_data)
