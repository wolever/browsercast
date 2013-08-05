import os
from urllib import quote

class Browsercast(object):
    default_assets = {
        "browsercast_js": "../browsercast.js",
        "browsercast_css": "../browsercast.css",
        "popcorn_js": "../popcorn-complete-1.3.min.js",
    }
    asset_order = [
        "popcorn_js",
        "browsercast_css",
        "browsercast_js",
    ]

    def __init__(self, **assets):
        self.assets = dict(self.default_assets)
        self.assets.update(assets)

    def asset_path(self, asset_name):
        asset_path = self.assets[asset_name]
        if asset_path.startswith("url:"):
            _, asset_path = asset_path.split(":", 1)
            return (True, asset_path)
        return (False, os.path.join(os.path.dirname(__file__), asset_path))

    def asset_tag(self, asset_name):
        is_url, asset_path = self.asset_path(asset_name)

        if asset_name.endswith("_js"):
            if is_url:
                return "<script src='%s'></script>" %(asset_path, )
            return "<script>eval(unescape('%s'))</script>" %(
                quote(open(asset_path).read()),
            )
        elif asset_name.endswith("_css"):
            if is_url:
                return "<link rel='stylesheet' href='%s' type='text/css' />" %(
                    asset_path,
                )
            return "<style>%s</style>" %(open(asset_path).read(), )
        else:
            raise AssertionError("Unknown asset format: %r" %(asset_name, ))

    def _repr_html_(self):
        result = [
            "<p class='bc-loading-status-output'>Loading BrowserCast&hellip;</p>"
        ]
        result.extend(self.asset_tag(n) for n in self.asset_order)
        return "\n".join(result)


def load(**kwargs):
    return Browsercast(**kwargs)
