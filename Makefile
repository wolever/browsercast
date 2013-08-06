all: browsercast/browsercast.css

browsercast/browsercast.css: browsercast/browsercast.less
	lessc $^ $@

serve:
	python -m SimpleHTTPServer 4240
