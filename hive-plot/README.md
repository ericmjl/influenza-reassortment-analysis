### [flock](http://drbunsen.github.com/flock/)&mdash;A Twitter Network Visualizer:

For more information on `flock` see [this blog post](http://www.drbunsen.org/twitter-hive-plots.html).

`flock` is a simple tool for generating hive plots from your Twitter network. `flock` uses Python 2.7 and has the following dependencies:

+ [Requests](http://docs.python-requests.org/en/latest/index.html)  
+ [ujson](http://pypi.python.org/pypi/ujson/)  

To run flock, issue this command:

```
$ python flock.py <twitter-id>
```

To generate a hive plot for me, @DrBunsen here is the command:

```
$ python flock.py 14621493
```

Note that the Twitter API limits the number of requests one can make per hour. If you have
a very large Twitter network or follow someone with a large network the script
may need to be modified to temporally pause until Twitter will allow you to make more
requests. As a minimial working example, I've provided my data file.
