BrowserCast is an IPython Notebook plugin which allows IPython Notebook
notebooks to be set to audio, creating a screencast-style presentation in the
browser - a browser cast.

**Status**: BrowserCast is under active development, and should work well
enough that you can use it to create useful presentations! It is currently
implemented as a bookmarklet instead of a "real" Notebook plugin, but that
will change soon. To give it a try, see: http://wolever.github.io/browsercast/

Traditional screencasts talking about BrowserCast:

* Why is BrowserCast cool? http://youtu.be/OAIyHgbi5rM
* Creating a presentation with BrowserCast: http://youtu.be/UhHRuPPFWtE
* Old proof-of-concept demonstration: http://youtu.be/CYxZq4rZw0c

Usage
------

As a Python package
...................

When loaded as a Python package, BrowserCast will be packaged along with the
notebook and will be useable by anyone who loads the notebook.

To load BrowserCast from a Python package:

1. Install it: ``pip install browsercast``
2. Open an IPython notebook (hint: ``ipython notebook``, then "New Notebook")
3. Run::

    import browsercast
    browsercast.load()

4. Follow the on-screen instructions to get started!


As a bookmarklet
................

When loaded as a bookmarklet, BrowserCast will only be useable for the session
it was loaded from (although the BrowserCast metadata will be saved to the
notebook, so the cell timings will still be useable in future sessions):

1. Install the bookmarklet from: http://wolever.github.io/browsercast/
2. Open an IPython notebook (hint: ``ipython notebook``, then "New Notebook")
3. Click the bookmarklet to load BrowserCast
4. Follow the on-screen instructions to get started!


During Development
..................

The simplest way to use BrowserCast during development is to pass
``browsercast_js`` and ``browsercast_css`` arguments to ``browsercast.load()``.

1. Get a copy of the source code: ``git clone git@github.com:wolever/browsercast.git``
2. Install the package in development mode: ``python setup.py develop``
3. Open an IPython notebook (hint: ``ipython notebook``, then "New Notebook")
4. Run::

    import browsercast
    browsercast.load(browsercast_js="url:files/browsercast/browsercast.js",
                     browsercast_css="url:files/browsercast/browsercast.css")


FAQ
---

| Q: What about recording audio in the browser too?
| A: Unfortunately the APIs aren't great at the moment, and Audacity is a very
     good tool for creating and editing audio.

| Q: Can people watching a browsercast interact with the IPython notebook?
| A: In theory they can, but there are some technical challenges that make it
     unlikely to be properly supported.
