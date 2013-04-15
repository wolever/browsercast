all: nblecture.css index.html

index.html: mkindex
	./mkindex http://wolever.github.io/nblecture/ > index.html

nblecture.css: nblecture.less
	lessc $^ $@

serve:
	python -m SimpleHTTPServer 4240
