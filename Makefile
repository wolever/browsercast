all: browsercast/browsercast.css index.html

index.html: mkindex mkbookmarklet
	./mkindex http://wolever.github.io/browsercast/ > index.html

browsercast/browsercast.css: browsercast/browsercast.less
	lessc $^ $@

serve:
	python -m SimpleHTTPServer 4240
