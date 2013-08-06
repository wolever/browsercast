#!/usr/bin/env python

import os
os.chdir(os.path.dirname(__file__) or ".")

from setuptools import setup, find_packages

import browsercast

version = "%s.%s.%s" %browsercast.__version__
setup(
    name="browsercast",
    version=version,
    url="https://github.com/wolever/browsercast",
    packages=find_packages(),
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
