all: browsercast.css index.html

index.html: mkindex mkbookmarklet
	./mkindex http://wolever.github.io/browsercast/ > index.html

browsercast.css: browsercast.less
	lessc $^ $@

serve:
	python -m SimpleHTTPServer 4240
