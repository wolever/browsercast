#!/usr/bin/env python

import os
os.chdir(os.path.dirname(__file__) or ".")

from setuptools import setup, find_packages

import browsercast

try:
    long_description = open("README.rst", "U").read()
except IOError:
    long_description = "See https://github.com/wolever/browsercast"

version = "%s.%s.%s" %browsercast.__version__
setup(
    name="browsercast",
    version=version,
    url="https://github.com/wolever/browsercast",
    author="David Wolever",
    author_email="david@wolever.net",
    packages=find_packages(),
    include_package_data=True,
    description="""
        An IPython Notebook plugin which allows IPython Notebook notebooks to
        be set to audio, creating a screencast-style presentation in the
        browser - a browser cast.
    """,
    long_description=long_description,
    zip_safe=False,
    license="BSD",
    classifiers=[ x.strip() for x in """
        Development Status :: 4 - Beta
        License :: OSI Approved :: BSD License
        Natural Language :: English
        Operating System :: OS Independent
        Programming Language :: Python
    """.split("\n") if x.strip() ],
)
