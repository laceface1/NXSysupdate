from __future__ import annotations

from argparse import ArgumentParser
from json import loads
from sys import argv, exit
from os import system, makedirs, listdir, rename
from shutil import rmtree
from subprocess import check_output
from typing import Union, Tuple

from requests import Session, packages
from http.cookiejar import CookiePolicy

from pyhac.cnmt.cnmt import Cnmt, ContentMetaRecord


def die(msg: str, code: int=-1):
    print(msg)
    exit(code)

class CookiePolicyBlockAll(CookiePolicy):
    return_ok = set_ok = domain_return_ok = path_return_ok =lambda self, *arg, **kwargs: False
    netscape = True
    rfc2965 = hide_cookie2 = False

class SysUpdateHandler():
    CDN_URL_BASE = "https://{}.hac.{}.{}.nintendo.net"
    SUN_URL_BASE = "https://{}.hac.{}.{}.nintendo.net/v1"
    CDN_URL = "https://atumn.hac.lp1.d4c.nintendo.net"
    SUN_URL = "https://sun.hac.lp1.d4c.nintendo.net/v1"
    CDN_NAME = "atumn"
    SUN_NAME = "sun"
    CDN_TEMPLATE = "{}/t/{}/{}/{}?device_id={}"
    SERVER_SET = "d4c"
    SERVER_ENV = "lp1"
    DEVICE_ID = "DEADBABECAFEBABE"
    FIRMWARE_VERSION = "5.1.0-3"
    PLATFORM = "NX"
    CHUNK_SIZE = 0x40000

    def __init__(self, *args, **kwargs):
        self.init(*args, **kwargs)
        self.init_session()
    
    def init(self, 
        cert_loc: str="./nx_tls_client_cert.pem", 
        device_id: str=None, 
        server: str=None, 
        env: str=None,
        fw_ver: str=None,
        platform: str=None
        ):
        self.cert = cert_loc
        if device_id is not None:
            self.DEVICE_ID = device_id
        if env is not None:
            self.SERVER_ENV = env
        if server is not None:
            self.SERVER_SET = server
        if fw_ver is not None:
            self.FIRMWARE_VERSION = fw_ver
        if platform is not None:
            self.PLATFORM = platform

    def init_session(self):
        packages.urllib3.disable_warnings() # pylint: disable=no-member
        self.session = Session()
        self.session.cookies.set_policy(CookiePolicyBlockAll())
        self.session.headers.update(
            {
                "user-agent": "NintendoSDK Firmware/{} (platform:{}; did:{}; eid:{})".format(
                    self.FIRMWARE_VERSION, self.PLATFORM, self.DEVICE_ID, self.SERVER_ENV
                )
            }
        )
        # TODO: init cdn urls

    def pretty_ver(self, ver: Union[int, str]) -> Tuple[str, int]:
        print(ver)
        ver = int(ver)
        return ("{}.{}.{}".format(
                    (ver >> 26) & 0x1f,
                    (ver >> 20) & 0x1f,
                    (ver >> 16) & 0x1f),
                ver & 0xffff)

    def get_latest_update(self):
        r = self.session.get(
            f"{self.SUN_URL}/system_update_meta?device_id={self.DEVICE_ID}",
            verify=False,
            cert=self.cert
        )
        if r.status_code != 200:
            die(f"[ERROR] [get_latest_update] Server returned non-ok status code: [{r.status_code}]")
        return loads(r.text)

    def get_content_id(self, tid: str, ver: str) -> str:
        url = self.CDN_TEMPLATE.format(
            self.CDN_URL,
            's' if tid == "0100000000000816" else 'a',
            tid,
            ver,
            self.DEVICE_ID
        )
        r = self.session.head(url, verify=False, cert=self.cert)
        
        if r.status_code == 200:
            return r.headers["X-Nintendo-Content-ID"]
        else:
            die(
                "[ERROR] [get_content_id] failed:\n"
                f" - url: \"{url}\""
                f" - status_code: [{r.status_code}]"
            )

    def print_latest_sys_version(self):
        update = self.get_latest_update()["system_update_metas"][0]
        nice_ver = self.pretty_ver(update["title_version"])
        print(
             ("Latest system version on CDN is:\n"
             " - Title: {0[title_id]} [{0[title_version]}]"
             " \"{1}\"").format(update, nice_ver)    
        )

    def stream_dl(self, url: str, fpath: str):
        print(f"[INFO] [stream_dl] Streaming '{url}' to '{fpath}'...")
        r = self.session.get(url, stream=True, cert=self.cert, verify=False)
        if r.status_code != 200:
            die(f"[ERROR] [stream_dl] status_code not ok [{r.status_code}]")

        content_id = r.headers.get("X-Nintendo-Content-ID", None)
        total_cnt, curr_cnt = int(r.headers["Content-Length"]), 0
        
        with open(fpath, "wb") as fp:
            for chunk in r.iter_content(self.CHUNK_SIZE):
                if l := len(chunk):
                    curr_cnt += l
                    print(
                        f"[INFO] [stream_dl] Downloading [{curr_cnt}/{total_cnt}]...", 
                        end="\r" if curr_cnt < total_cnt else "\n"
                    )
                    fp.write(chunk)        
        return fpath, content_id

    def stream_from_cdn(self, tid: str, ver: str, fpath: str, magic: str="c"):
        return self.stream_dl(
            self.CDN_TEMPLATE.format(
                self.CDN_URL,
                magic,
                tid,
                ver,
                self.DEVICE_ID
            ),
            fpath
        )

    def get_latest_full(self, fpath: str, ver: str=None):
        update = self.get_latest_update()["system_update_metas"][0]
        if ver is None:
            ver = update["title_version"]
        titleid = update["title_id"]

        semver, buildnum = self.pretty_ver(ver)
        if fpath is None:
            fpath = f"sysupdate-[{ver}]-{semver}-bn_{buildnum}"

        makedirs(fpath, exist_ok=True)
        _, content_id = self.stream_from_cdn(
            titleid,
            ver,
            f"{fpath}/meta.nca",
            "s"
        )

        rename(f"{fpath}/meta.nca", f"{fpath}/{content_id}.nca")
        check_output(["hactool", f"{fpath}/{content_id}.nca", f"--section0dir={fpath}/meta_nca_exefs", "--disablekeywarns"])
        with Cnmt(fpath=f"{fpath}/meta_nca_exefs/SystemUpdate_0100000000000816.cnmt", json=None, keyset=None) as cnmt:
            for title in cnmt.content_meta_records:
                self.download_title(title, fpath)

        rmtree(f"{fpath}/meta_nca_exefs", ignore_errors=True)
        rmtree(f"{fpath}/meta_nca_exefs", ignore_errors=True)
        rmtree(f"{fpath}/temp", ignore_errors=True)

    def download_title(self, title: Union[Tuple[str, int], Cnmt], fpath: str):
        if isinstance(title, ContentMetaRecord):
            title_id = title.title_id
            version = title.version
        else:
            title_id = title[0]
            version = title[1]
        
        makedirs(fpath, exist_ok=True)
        print(f"[INFO] [download_title] Downloading {title_id}, ver '{self.pretty_ver(version)}' [{version}]")

        content_id = self.get_content_id(title_id, version)
        meta_nca, _ = self.stream_dl(
            "{}/c/{}/{}?device_id={}".format(
                self.CDN_URL,
                's' if title_id == "0100000000000816" else 'a',
                content_id,
                self.DEVICE_ID
            ),
            f"{fpath}/{content_id}.cnmt.nca"
        )
        temp_dir = f"{fpath}/temp/{content_id}"
        makedirs(temp_dir)
        check_output(["hactool", meta_nca, f"--section0dir={temp_dir}", "--disablekeywarns"])

        meta = self.find_cnmt(f"{temp_dir}")

        with Cnmt(fpath=meta) as cnmt:
            for title in cnmt.content_records:
                self.stream_dl(
                    "{}/c/c/{}".format(
                        self.CDN_URL,
                        title.content_id
                    ),
                    f"{fpath}/{title.content_id}.nca"
                )

    def find_cnmt(self, fpath: str):
        for f in listdir(fpath):
            if f.endswith(".cnmt"):
                return f"{fpath}/{f}"

def main(args):
    ctx = SysUpdateHandler(
        cert_loc=args.cert,
        device_id=args.deviceid,
        server=args.server,
        env=args.env,
        fw_ver=args.firmware_version,
        platform=args.platform
    )
    
    if args.info:
        ctx.print_latest_sys_version()

    if args.latest:
        ctx.get_latest_full(args.output)

    if args.get_content_id:
        print(ctx.get_content_id(args.title_id, args.title_version))

if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--info", "-i", help="Display information", action="store_true")
    parser.add_argument("--cert", "-c", help="Path to a cert", default="nx_tls_client_cert.pem")
    parser.add_argument("--deviceid", "-d", help="The deviceid string to be sent.", default="DEADCAFEBABEBEEF")
    parser.add_argument("--env", "-e", help="The server environment", default="lp1")
    parser.add_argument("--server", "-s", help="The server", default="d4c")
    parser.add_argument("--platform", "-p", help="The platform", default="NX")
    parser.add_argument("--firmware-version", "-fwver", help="The firmware version string to be sent", default="5.1.0-3")
    parser.add_argument("--latest", "-l", help="Download the latest version", action="store_true")
    parser.add_argument("--output", "-o", help="The output folder", default=None)
    parser.add_argument("--get-content-id", action="store_true")
    parser.add_argument("--title-id")
    parser.add_argument("--title-version")    
    
    args = parser.parse_args()
    main(args)
