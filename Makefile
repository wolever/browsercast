all: nblecture.css

nblecture.css: nblecture.less
	lessc $^ $@

serve:
	python -m SimpleHTTPServer 4240
