all: browsercast.css

browsercast.css: browsercast.less
	lessc $^ $@

serve:
	python -m SimpleHTTPServer 4240
