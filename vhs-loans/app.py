import os, json, sqlite3, secrets, datetime as dt
from functools import wraps
from flask import (Flask, request, session, redirect, url_for, render_template_string, abort, g, flash)
from werkzeug.security import generate_password_hash, check_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("DB_PATH", os.path.join(BASE, "data", "loans.db"))
os.makedirs(os.path.dirname(DB), exist_ok=True)
ACTIVE = ("Đang vay", "Còn hạn theo hồ sơ")          # chỉ 2 trạng thái này được cộng vào dư nợ
STATUSES = ["Đang vay", "Còn hạn theo hồ sơ", "Chờ xác minh", "Đã tất toán"]
FIELDS = ["ma", "cty", "nh", "hd", "loai", "goc", "ls", "gn", "dh", "ngay_nguon", "tt", "ghichu", "ky_lai"]

app = Flask(__name__)
kf = os.path.join(os.path.dirname(DB), "secret.key")
if not os.path.exists(kf): open(kf, "w").write(secrets.token_hex(32))
app.secret_key = open(kf).read()
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax",
                  SESSION_COOKIE_SECURE=os.environ.get("HTTPS")=="1",
                  PERMANENT_SESSION_LIFETIME=dt.timedelta(hours=8))

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB); g.db.row_factory = sqlite3.Row
    return g.db
@app.teardown_appcontext
def close(_):
    d = g.pop("db", None)
    if d: d.close()

def init():
    c = sqlite3.connect(DB)
    c.executescript("""CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, pw TEXT,
      role TEXT, companies TEXT DEFAULT '', active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS loans(id INTEGER PRIMARY KEY, ma TEXT UNIQUE, cty TEXT, nh TEXT, hd TEXT, loai TEXT,
      goc INTEGER, ls REAL, gn TEXT, dh TEXT, ngay_nguon TEXT, tt TEXT, ghichu TEXT, ky_lai INTEGER);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, ts TEXT, user TEXT, action TEXT, ma TEXT, detail TEXT);""")
    if not c.execute("SELECT 1 FROM users").fetchone():
        pw = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(9)
        c.execute("INSERT INTO users(username,pw,role) VALUES('admin',?,'admin')", (generate_password_hash(pw),))
        print(f"\n*** TÀI KHOẢN ADMIN: admin / {pw}  (đổi mật khẩu sau khi đăng nhập) ***\n")
    if not c.execute("SELECT 1 FROM users WHERE username='ketoanbank'").fetchone():
        kp = os.environ.get("KETOAN_PASSWORD") or secrets.token_urlsafe(9)
        c.execute("INSERT INTO users(username,pw,role,companies) VALUES('ketoanbank',?,'accountant','*')", (generate_password_hash(kp),))
        print(f"*** TÀI KHOẢN KẾ TOÁN: ketoanbank / {kp}  (tất cả công ty) ***\n")
    if not c.execute("SELECT 1 FROM loans").fetchone():
        for r in json.load(open(os.path.join(BASE, "seed.json"))):
            ls = round(r["ls"] * 100, 4) if r["ls"] is not None else None   # lưu dạng %/năm
            c.execute("INSERT INTO loans(ma,cty,nh,hd,loai,goc,ls,gn,dh,ngay_nguon,tt,ghichu,ky_lai) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (r["ma"], r["cty"], r["nh"], r["hd"], r["loai"], r["goc"], ls, r["gn"], r["dh"], r["ngay_nguon"], r["tt"], r["ghichu"], r["ky_lai"]))
        c.execute("INSERT INTO audit(ts,user,action,ma,detail) VALUES(?,?,?,?,?)", (now(), "system", "import", "", "Nạp 47 khoản từ file Excel 02/10/2026"))
    c.commit(); c.close()

now = lambda: dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
def log(action, ma, detail=""):
    db().execute("INSERT INTO audit(ts,user,action,ma,detail) VALUES(?,?,?,?,?)", (now(), session.get("u"), action, ma, detail))

@app.template_filter("vnd")
def vnd(n): return "—" if n is None else f"{int(n):,}".replace(",", ".")
@app.template_filter("ty")
def ty(n): return f"{(n or 0)/1e9:,.3f}".replace(",", "X").replace(".", ",").replace("X", ".")
@app.template_filter("dmy")
def dmy(s): return dt.date.fromisoformat(s).strftime("%d/%m/%Y") if s else "—"

def me():
    if "u" not in session: return None
    u = db().execute("SELECT * FROM users WHERE username=? AND active=1", (session["u"],)).fetchone()
    return u
def mycos(u): return [x for x in (u["companies"] or "").split("|") if x]
def allco(u): return u["role"] == "admin" or "*" in mycos(u)      # "*" = tất cả công ty (hiện tại và tương lai)
def login_required(f):
    @wraps(f)
    def w(*a, **k):
        g.user = me()
        if not g.user: return redirect(url_for("login"))
        return f(*a, **k)
    return w
def admin_required(f):
    @wraps(f)
    @login_required
    def w(*a, **k):
        if g.user["role"] != "admin": abort(403)
        return f(*a, **k)
    return w

@app.before_request
def csrf():
    if request.method == "POST":
        if not secrets.compare_digest(request.form.get("_t", ""), session.get("_t", "x")): abort(400)
@app.context_processor
def ctx():
    session.setdefault("_t", secrets.token_hex(16))
    return dict(T=session["_t"], U=getattr(g, "user", None), STATUSES=STATUSES, ACTIVE=ACTIVE)

# ---------- phân quyền dữ liệu: MỌI truy vấn của kế toán đều bị ép theo công ty ----------
def scope_sql(u):
    if allco(u): return "1=1", []
    cs = mycos(u)
    return ("cty IN (%s)" % ",".join("?" * len(cs))) if cs else "0", cs
def get_loan(id):
    w, p = scope_sql(g.user)
    r = db().execute(f"SELECT * FROM loans WHERE id=? AND {w}", [id] + p).fetchone()
    if not r: abort(404)
    return r

def warnings(r, today):
    w = []
    if r["tt"] in ACTIVE:
        if r["ls"] is None: w.append("Thiếu lãi suất")
        elif r["ls"] > 10: w.append("Lãi >10%")
        if r["dh"]:
            d = (dt.date.fromisoformat(r["dh"]) - today).days
            if d < 0: w.append("QUÁ HẠN")
            elif d <= 30: w.append("Đến hạn ≤30 ngày")
            elif d <= 90: w.append("Đến hạn 31–90 ngày")
        else: w.append("Thiếu ngày đáo hạn")
        if not r["ngay_nguon"]: w.append("Thiếu ngày nguồn số gốc")
    if r["tt"] == "Chờ xác minh": w.append("Chờ xác minh – không cộng tổng")
    if r["tt"] == "Đã tất toán" and False: pass
    return w

PAL = ["#0e7c86", "#2f5fc4", "#e0a526", "#7a5bc0", "#d2603f", "#2a9d6b", "#5aa9e6", "#8a9ba5", "#b8860b"]
def donut(items, top, sub):
    t = sum(x[1] for x in items) or 1; o = 0; R = 44; C = 2 * 3.14159265 * R; arcs = ""
    for _, v, col in items:
        if v > 0:
            l = v / t * C; arcs += f'<circle cx="60" cy="60" r="{R}" fill="none" stroke="{col}" stroke-width="18" stroke-dasharray="{l:.2f} {C-l:.2f}" stroke-dashoffset="{-o:.2f}"/>'; o += l
    return (f'<svg viewBox="0 0 120 120" class="dn"><g transform="rotate(-90 60 60)"><circle cx="60" cy="60" r="{R}" fill="none" stroke="var(--b)" stroke-width="18"/>{arcs}</g>'
            f'<text x="60" y="58" text-anchor="middle" class="dt">{top}</text><text x="60" y="71" text-anchor="middle" class="ds">{sub}</text></svg>')
def fm(n): return f"{n/1e9:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
def panel(title, items, top, sub):
    t = sum(x[1] for x in items) or 1
    return dict(title=title, svg=donut(items, top, sub), rows=[(a, b, c, b * 100 / t) for a, b, c in items])

def dashboard():
    today = dt.date.today()
    rows = db().execute("SELECT * FROM loans").fetchall()
    act = [r for r in rows if r["tt"] in ACTIVE]
    tot = sum(r["goc"] for r in act)
    sh = sum(r["goc"] for r in act if r["loai"] == "Ngắn hạn")
    lg = sum(r["goc"] for r in act if r["loai"] == "Dài hạn")
    def due(a, b): return sum(r["goc"] for r in act if r["dh"] and a <= (dt.date.fromisoformat(r["dh"]) - today).days <= b)
    rated = [r for r in act if r["ls"] is not None]
    rs = sum(r["goc"] for r in rated)
    avg = sum(r["goc"] * r["ls"] for r in rated) / rs if rs else None
    def group(key):
        d = {}
        for r in act:
            x = d.setdefault(r[key], [0, 0]); x[0 if r["loai"] == "Ngắn hạn" else 1] += r["goc"]
        return sorted(((k, v[0], v[1], v[0] + v[1]) for k, v in d.items()), key=lambda z: -z[3])
    byc, byb = group("cty"), group("nh")
    groups = [("Không quá 10%", lambda r: r["ls"] is not None and r["ls"] <= 10, "#2a9d6b"), ("Trên 10% đến 12%", lambda r: r["ls"] is not None and 10 < r["ls"] <= 12, "#e0a526"),
              ("Trên 12% đến 15%", lambda r: r["ls"] is not None and 12 < r["ls"] <= 15, "#d2603f"), ("Trên 15%", lambda r: r["ls"] is not None and r["ls"] > 15, "#b3261e"), ("Chưa có lãi suất", lambda r: r["ls"] is None, "#8a9ba5")]
    rg = [(f"{n} ({sum(1 for r in act if f(r))} khoản)", sum(r["goc"] for r in act if f(r)), c) for n, f, c in groups]
    gt10 = sum(r["goc"] for r in rated if r["ls"] > 10)
    pn = [panel("Cơ cấu dư nợ theo công ty", [(k, c, PAL[i % 9]) for i, (k, a, b, c) in enumerate(byc)], fm(tot), "tỷ VND"),
          panel("Cơ cấu theo ngân hàng", [(k, c, PAL[(i + 1) % 9]) for i, (k, a, b, c) in enumerate(byb) if c > 0], fm(tot), "tỷ VND"),
          panel("Nhóm lãi suất", rg, fm(gt10), "tỷ lãi >10%")]
    hero = donut([("Ngắn hạn", sh, "#ffd166"), ("Dài hạn", lg, "#7ee0e8")], fm(tot), "tỷ VND")
    return dict(pn=pn, hero=hero, fm=fm(tot), shp=sh * 100 / tot if tot else 0, lgp=lg * 100 / tot if tot else 0, tot=tot, sh=sh, lg=lg, n=len(act), d30=due(0, 30), d90=due(31, 90),
                over=sum(r["goc"] for r in act if r["dh"] and dt.date.fromisoformat(r["dh"]) < today),
                avg=avg, norate=sum(1 for r in act if r["ls"] is None), pend=sum(1 for r in rows if r["tt"] == "Chờ xác minh"),
                gt10=gt10, byc=byc, byb=byb,
                ok=(sum(x[3] for x in byc) == tot == sum(x[3] for x in byb) == sh + lg), today=today)

# ---------- giao diện ----------
CSS = """:root{--bg:#f4f6fb;--c:#fff;--p:#0b3d91;--p2:#1e6fe0;--t:#1b2433;--m:#6b768a;--ok:#12805c;--w:#c77700;--e:#c62828;--b:#e3e8f2}
*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--t)}
header{background:linear-gradient(135deg,#0b3d91,#1e6fe0);color:#fff;padding:12px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
header b{font-size:17px;flex:1}header a{color:#dbe8ff;text-decoration:none;font-size:14px}header a:hover{color:#fff}
main{max-width:1280px;margin:0 auto;padding:16px}h2{margin:18px 0 10px;font-size:16px;color:var(--p)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.card{background:var(--c);border-radius:14px;padding:14px 16px;box-shadow:0 1px 3px #1b243314;border-left:5px solid var(--p2)}
.card small{color:var(--m);display:block}.card strong{font-size:21px;display:block;margin-top:2px}.card em{font-style:normal;color:var(--m);font-size:12px}
.card.w{border-color:var(--w)}.card.e{border-color:var(--e)}.card.ok{border-color:var(--ok)}
.box{background:var(--c);border-radius:14px;padding:14px;box-shadow:0 1px 3px #1b243314;overflow-x:auto;margin-bottom:14px}
table{border-collapse:collapse;width:100%;font-size:14px}th{background:#eef3fc;color:var(--p);text-align:left;padding:8px 10px;white-space:nowrap}
td{padding:8px 10px;border-top:1px solid var(--b);vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap}
tr.tot td{font-weight:700;background:#f7f9fd}.bar{height:7px;border-radius:4px;background:#dbe6fb;margin-top:4px}.bar i{display:block;height:100%;border-radius:4px;background:var(--p2)}
.tag{display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;background:#e8eefb;color:var(--p);margin:1px}.tag.w{background:#fff1d6;color:#8a5200}.tag.e{background:#fde0e0;color:var(--e)}.tag.ok{background:#dcf5ea;color:var(--ok)}
input,select,textarea{width:100%;padding:9px 10px;border:1px solid #cdd5e4;border-radius:9px;font:inherit;background:#fff}
label{display:block;font-size:13px;color:var(--m);margin:8px 0 3px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 14px}
.btn{display:inline-block;background:var(--p2);color:#fff;border:0;padding:9px 16px;border-radius:9px;font:inherit;text-decoration:none;cursor:pointer}.btn.g{background:#e8eefb;color:var(--p)}.btn.r{background:var(--e)}
.flash{background:#dcf5ea;color:var(--ok);padding:10px 14px;border-radius:10px;margin-bottom:12px}.flash.e{background:#fde0e0;color:var(--e)}
.login{max-width:360px;margin:12vh auto}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.row>*{flex:1;min-width:140px}
@media(max-width:700px){main{padding:10px}.card strong{font-size:18px}}
:root{--p:#0e7c86;--p2:#0a5560;--ink:var(--t)}header{background:linear-gradient(135deg,#0a5560,#0e7c86)}.btn{background:var(--p)}
.hero{background:linear-gradient(120deg,#073b44 0%,#0e7c86 55%,#2f5fc4 120%);color:#fff;border-radius:18px;padding:22px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;box-shadow:0 10px 30px #0e7c8633}
.hero small{opacity:.8}.hero .big{font-size:clamp(28px,6vw,46px);font-weight:700;letter-spacing:-.5px;line-height:1.1;margin:4px 0 2px}.hero .sub{opacity:.85;font-size:14px}
.hero .mini{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.hero .mini div{background:#ffffff1f;border-radius:12px;padding:8px 14px;min-width:120px}.hero .mini b{display:block;font-size:17px}.hero .mini span{font-size:12px;opacity:.85}
.hero .dn{width:170px;height:170px}.hero .dt{fill:#fff}.hero .ds{fill:#ffffffbb}.dn{width:150px;height:150px;flex:none}.dt{font:700 15px system-ui;fill:var(--t)}.ds{font:9px system-ui;fill:var(--m)}
.sec{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px;margin-top:12px}.sec .box{margin:0;border-radius:16px;box-shadow:0 2px 12px #12232e12}.sec h3{margin:0 0 10px;font-size:15px}.pie{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
ul.lg{list-style:none;margin:0;padding:0;flex:1;min-width:150px;font-size:13px}ul.lg li{display:grid;grid-template-columns:12px 1fr auto auto;gap:6px;align-items:center;padding:3px 0}ul.lg i{width:10px;height:10px;border-radius:3px}ul.lg em{font-style:normal;color:var(--m);width:44px;text-align:right}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:12px}.kpi{background:var(--c);border-radius:16px;padding:14px 16px;box-shadow:0 2px 12px #12232e12;border-left:5px solid var(--p)}
.kpi.w{border-color:var(--w)}.kpi.e{border-color:var(--e)}.kpi.ok{border-color:var(--ok)}.kpi small{color:var(--m);display:block;font-size:12.5px}.kpi strong{font-size:21px;display:block;margin:2px 0}.kpi em{font-style:normal;font-size:12px;color:var(--m)}
@media(max-width:640px){.hero{grid-template-columns:1fr}.hero .dn{justify-self:center}}"""
LAYOUT = """<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quản lý khoản vay VHS Group</title><style>""" + CSS + """</style></head><body>
{% if U %}<header><b>🏦 QUẢN LÝ KHOẢN VAY VHS GROUP</b>
{% if U.role=='admin' %}<a href="/">Dashboard</a><a href="/loans">Chi tiết vay</a><a href="/admin/users">Tài khoản</a><a href="/admin/audit">Nhật ký</a>{% else %}<a href="/loans">Khoản vay của tôi</a>{% endif %}
<a href="/password">Đổi mật khẩu</a><a href="/logout">Thoát ({{U.username}})</a></header>{% endif %}
<main>{% for c,m in get_flashed_messages(with_categories=true) %}<div class="flash {{c}}">{{m}}</div>{% endfor %}{% block body %}{% endblock %}</main>
  <!-- Nút nổi về hub (HUB_URL trống = ẩn) -->
  <a id="hub-fab" href="{{HUB_URL}}" title="Về trang chủ" aria-label="Về trang chủ"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></a>
  <dialog id="hub-dlg" aria-labelledby="hub-dlg-t"><div>
    <h3 id="hub-dlg-t">Quay về trang chủ?</h3>
    <p>Bạn sẽ rời ứng dụng này và quay về trang danh sách ứng dụng.</p>
    <form method="dialog"><button value="">Ở lại</button><button value="go" autofocus>Quay về</button></form>
  </div></dialog>
  <style>
    #hub-fab{position:fixed;right:20px;bottom:20px;z-index:90;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:var(--p,#0b3d91);color:#fff;box-shadow:0 6px 20px #0003;transition:transform .15s}
    #hub-fab:hover{transform:scale(1.07)}
    #hub-fab:focus-visible{outline:3px solid var(--p,#0b3d91);outline-offset:3px}
    #hub-dlg{border:0;border-radius:14px;padding:0;width:min(360px,calc(100vw - 32px));box-shadow:0 20px 50px #0004;font:inherit;color:inherit}
    #hub-dlg::backdrop{background:#0007}
    #hub-dlg>div{padding:22px}
    #hub-dlg h3{margin:0 0 6px;font-size:17px}
    #hub-dlg p{margin:0 0 18px;color:#5b6475;font-size:14px;line-height:1.5}
    #hub-dlg form{display:flex;justify-content:flex-end;gap:8px}
    #hub-dlg button{font:inherit;font-size:14px;padding:8px 16px;border-radius:8px;border:1px solid #d5dbe6;background:#fff;color:inherit;cursor:pointer}
    #hub-dlg button[value=go]{background:var(--p,#0b3d91);border-color:transparent;color:#fff}
  </style>
  <script>
    (() => {
      const fab = document.getElementById('hub-fab'), dlg = document.getElementById('hub-dlg');
      if (!fab.getAttribute('href')) return fab.remove();
      fab.onclick = e => { e.preventDefault(); dlg.returnValue = ''; dlg.showModal(); };
      dlg.onclick = e => { if (e.target === dlg) dlg.close(); };   // bấm ra ngoài = Ở lại
      dlg.onclose = () => { if (dlg.returnValue === 'go') location.href = fab.href; };
    })();
  </script>
</body></html>"""
def page(body, **kw):
    return render_template_string(LAYOUT.replace("{% block body %}{% endblock %}", body), HUB_URL=os.environ.get("HUB_URL", ""), **kw)

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        ip = request.remote_addr; fails = app.config.setdefault("F", {})
        if fails.get(ip, 0) >= 8: flash("Quá nhiều lần sai. Thử lại sau ít phút.", "e")
        else:
            u = db().execute("SELECT * FROM users WHERE username=? AND active=1", (request.form["username"].strip(),)).fetchone()
            if u and check_password_hash(u["pw"], request.form["password"]):
                fails.pop(ip, None); session.clear(); session["u"] = u["username"]; session.permanent = True
                g.user = u; log("login", ""); db().commit(); return redirect("/")
            fails[ip] = fails.get(ip, 0) + 1; flash("Sai tên đăng nhập hoặc mật khẩu.", "e")
    return page("""<div class="box login"><h2>Đăng nhập</h2><form method="post"><input type="hidden" name="_t" value="{{T}}">
    <label>Tên đăng nhập</label><input name="username" autofocus required><label>Mật khẩu</label><input type="password" name="password" required>
    <p><button class="btn" style="width:100%">Đăng nhập</button></p></form></div>""")

@app.route("/logout")
def logout(): session.clear(); return redirect("/login")

@app.route("/password", methods=["GET", "POST"])
@login_required
def password():
    if request.method == "POST":
        if not check_password_hash(g.user["pw"], request.form["old"]) or len(request.form["new"]) < 8:
            flash("Mật khẩu cũ sai hoặc mật khẩu mới dưới 8 ký tự.", "e")
        else:
            db().execute("UPDATE users SET pw=? WHERE id=?", (generate_password_hash(request.form["new"]), g.user["id"]))
            log("đổi mật khẩu", ""); db().commit(); flash("Đã đổi mật khẩu.", "")
            return redirect("/")
    return page("""<div class="box" style="max-width:420px"><h2>Đổi mật khẩu</h2><form method="post"><input type="hidden" name="_t" value="{{T}}">
    <label>Mật khẩu hiện tại</label><input type="password" name="old" required><label>Mật khẩu mới (≥ 8 ký tự)</label><input type="password" name="new" required>
    <p><button class="btn">Lưu</button></p></form></div>""")

@app.route("/")
@login_required
def home():
    if g.user["role"] != "admin": return redirect("/loans")
    d = dashboard()
    return page("""<div class="hero"><div><small>Gốc các khoản còn vay · tính đến {{d.today|string|dmy}}</small><div class="big">{{d.tot|vnd}} đ</div><div class="sub">{{d.n}} khoản · {{d.fm}} tỷ VND · chưa chốt dư nợ chung</div>
<div class="mini"><div><b>{{d.sh|ty}} tỷ</b><span>Ngắn hạn ({{'%.1f'|format(d.shp)}}%)</span></div><div><b>{{d.lg|ty}} tỷ</b><span>Dài hạn ({{'%.1f'|format(d.lgp)}}%)</span></div><div><b>{{ ('%.2f'|format(d.avg)).replace('.',',') if d.avg else '—' }}%</b><span>Lãi suất BQ gia quyền</span></div></div></div>{{d.hero|safe}}</div>
<div class="kpis"><div class="kpi e"><small>Quá hạn</small><strong>{{d.over|ty}} tỷ</strong><em>gốc đã qua ngày đáo hạn</em></div>
<div class="kpi w"><small>Đến hạn ≤ 30 ngày</small><strong>{{d.d30|ty}} tỷ</strong><em>{{d.d30|vnd}} đ</em></div><div class="kpi w"><small>Đến hạn 31–90 ngày</small><strong>{{d.d90|ty}} tỷ</strong><em>{{d.d90|vnd}} đ</em></div>
<div class="kpi w"><small>Dư nợ lãi &gt; 10%</small><strong>{{d.gt10|ty}} tỷ</strong><em>{{d.gt10|vnd}} đ</em></div><div class="kpi w"><small>Thiếu lãi suất</small><strong>{{d.norate}} khoản</strong><em>cần xác minh</em></div>
<div class="kpi w"><small>Chờ xác minh</small><strong>{{d.pend}} khoản</strong><em>không cộng vào tổng</em></div><div class="kpi {{'ok' if d.ok else 'e'}}"><small>Đối chiếu tổng</small><strong>{{'KHỚP ✓' if d.ok else 'LỆCH ✗'}}</strong><em>công ty = ngân hàng = ngắn + dài</em></div></div>
<div class="sec">{% for p in d.pn %}<div class="box"><h3>{{p.title}}</h3><div class="pie">{{p.svg|safe}}<ul class="lg">{% for a,b,c,pc in p.rows %}<li><i style="background:{{c}}"></i><span>{{a}}</span><b>{{b|ty}}</b><em>{{'%.1f'|format(pc)}}%</em></li>{% endfor %}</ul></div></div>{% endfor %}</div>
<h2>DƯ NỢ THEO CÔNG TY</h2><div class="box"><table><tr><th>Công ty</th><th class=n>Ngắn hạn</th><th class=n>Dài hạn</th><th class=n>Tổng (đ)</th><th style="width:22%">Tỷ trọng</th></tr>
{% for k,a,b,c in d.byc %}<tr><td><a href="/loans?cty={{k|urlencode}}">{{k}}</a></td><td class=n>{{a|vnd}}</td><td class=n>{{b|vnd}}</td><td class=n>{{c|vnd}}</td>
<td>{{'%.1f'|format(c*100/d.tot)}}%<div class=bar><i style="width:{{c*100/d.tot}}%"></i></div></td></tr>{% endfor %}
<tr class=tot><td>Tổng</td><td class=n>{{d.sh|vnd}}</td><td class=n>{{d.lg|vnd}}</td><td class=n>{{d.tot|vnd}}</td><td>100%</td></tr></table></div>
<h2>DƯ NỢ THEO NGÂN HÀNG</h2><div class="box"><table><tr><th>Ngân hàng</th><th class=n>Ngắn hạn</th><th class=n>Dài hạn</th><th class=n>Tổng (đ)</th></tr>
{% for k,a,b,c in d.byb %}<tr><td>{{k}}</td><td class=n>{{a|vnd}}</td><td class=n>{{b|vnd}}</td><td class=n>{{c|vnd}}</td></tr>{% endfor %}
<tr class=tot><td>Tổng</td><td class=n>{{d.sh|vnd}}</td><td class=n>{{d.lg|vnd}}</td><td class=n>{{d.tot|vnd}}</td></tr></table></div>
<p style="color:var(--m);font-size:13px">Quy tắc: chỉ cộng khoản ở trạng thái «Đang vay» và «Còn hạn theo hồ sơ». «Chờ xác minh» và «Đã tất toán» không được cộng. Mọi con số tính trực tiếp từ dữ liệu kế toán nhập, không nhập tay.</p>""", d=d)

@app.route("/loans")
@login_required
def loans():
    w, p = scope_sql(g.user); q = f"SELECT * FROM loans WHERE {w}"
    cty, st = request.args.get("cty", ""), request.args.get("tt", "")
    if cty: q += " AND cty=?"; p.append(cty)
    if st: q += " AND tt=?"; p.append(st)
    rows = db().execute(q + " ORDER BY cty, dh", p).fetchall()
    today = dt.date.today()
    cos = [r[0] for r in db().execute(f"SELECT DISTINCT cty FROM loans WHERE {scope_sql(g.user)[0]} ORDER BY 1", scope_sql(g.user)[1])]
    tot = sum(r["goc"] for r in rows if r["tt"] in ACTIVE)
    W = {r["id"]: warnings(r, today) for r in rows}
    return page("""<div class="box"><form class="row"><div><label>Công ty</label><select name="cty"><option value="">Tất cả</option>{% for c in cos %}<option {{'selected' if c==request.args.get('cty')}}>{{c}}</option>{% endfor %}</select></div>
<div><label>Trạng thái</label><select name="tt"><option value="">Tất cả</option>{% for s in STATUSES %}<option {{'selected' if s==request.args.get('tt')}}>{{s}}</option>{% endfor %}</select></div>
<div><button class="btn g">Lọc</button> <a class="btn" href="/loans/new">+ Thêm khoản vay</a></div></form></div>
<div class="box"><table><tr><th>Mã</th><th>Công ty</th><th>Ngân hàng</th><th>Hợp đồng</th><th>Loại</th><th class=n>Gốc (đ)</th><th class=n>Lãi %</th><th>Đáo hạn</th><th>Ngày nguồn</th><th>Trạng thái</th><th>Cảnh báo</th><th></th></tr>
{% for r in rows %}<tr style="{{'opacity:.55' if r.tt not in ACTIVE}}"><td>{{r.ma}}</td><td>{{r.cty}}</td><td>{{r.nh}}</td><td>{{r.hd or '—'}}</td><td>{{r.loai}}</td><td class=n>{{r.goc|vnd}}</td>
<td class=n>{{r.ls if r.ls is not none else '—'}}</td><td>{{r.dh|dmy}}</td><td>{{r.ngay_nguon|dmy}}</td>
<td><span class="tag {{'ok' if r.tt in ACTIVE else ''}}">{{r.tt}}</span></td>
<td>{% for x in W[r.id] %}<span class="tag {{'e' if 'QUÁ' in x else 'w'}}">{{x}}</span>{% endfor %}</td><td><a class="btn g" href="/loans/{{r.id}}">Sửa</a></td></tr>{% endfor %}
<tr class=tot><td colspan=5>Tổng gốc còn vay trong danh sách ({{rows|length}} dòng)</td><td class=n>{{tot|vnd}}</td><td colspan=6></td></tr></table></div>""", rows=rows, cos=cos, tot=tot, W=W)

FORM = """<div class="box"><h2>{{'Thêm khoản vay' if not r else 'Sửa '+r.ma}}</h2><form method="post"><input type="hidden" name="_t" value="{{T}}"><div class="grid">
<div><label>Mã khoản vay</label><input name="ma" value="{{r.ma if r}}" required {{'readonly' if r}}></div>
<div><label>Công ty</label>{% if cos %}<select name="cty">{% for c in cos %}<option {{'selected' if r and r.cty==c}}>{{c}}</option>{% endfor %}</select>{% else %}<input name="cty" value="{{r.cty if r}}" required>{% endif %}</div>
<div><label>Ngân hàng</label><input name="nh" value="{{r.nh if r}}" required></div><div><label>Hợp đồng / khế ước</label><input name="hd" value="{{r.hd or '' if r}}"></div>
<div><label>Loại vay</label><select name="loai">{% for s in ['Ngắn hạn','Dài hạn'] %}<option {{'selected' if r and r.loai==s}}>{{s}}</option>{% endfor %}</select></div>
<div><label>Gốc còn lại (VND)</label><input name="goc" inputmode="numeric" value="{{r.goc if r}}" required></div>
<div><label>Lãi suất (%/năm) – để trống nếu chưa xác nhận</label><input name="ls" inputmode="decimal" value="{{r.ls if r and r.ls is not none}}"></div>
<div><label>Ngày giải ngân</label><input type="date" name="gn" value="{{r.gn or '' if r}}"></div><div><label>Ngày đáo hạn</label><input type="date" name="dh" value="{{r.dh or '' if r}}"></div>
<div><label>Ngày nguồn số gốc (ngày xác nhận dư nợ)</label><input type="date" name="ngay_nguon" value="{{r.ngay_nguon or '' if r}}"></div>
<div><label>Trạng thái</label><select name="tt">{% for s in STATUSES %}<option {{'selected' if r and r.tt==s}}>{{s}}</option>{% endfor %}</select></div>
<div><label>Ngày trả lãi định kỳ (1–31)</label><input name="ky_lai" inputmode="numeric" value="{{r.ky_lai or '' if r}}"></div></div>
<label>Ghi chú / nguồn</label><textarea name="ghichu" rows="3">{{r.ghichu or '' if r}}</textarea>
<p><button class="btn">Lưu</button> <a class="btn g" href="/loans">Huỷ</a>
{% if r and U.role=='admin' %}<button class="btn r" formaction="/loans/{{r.id}}/delete" onclick="return confirm('Xoá hẳn khoản này?')">Xoá</button>{% endif %}</p></form></div>"""

def parse(form, u, old=None):
    f = {k: (form.get(k) or "").strip() for k in FIELDS}
    errs = []
    try: f["goc"] = int(f["goc"].replace(".", "").replace(",", ""))
    except ValueError: errs.append("Gốc phải là số nguyên VND."); f["goc"] = 0
    if f["goc"] < 0: errs.append("Gốc không được âm.")
    try: f["ls"] = float(f["ls"].replace(",", ".")) if f["ls"] else None
    except ValueError: errs.append("Lãi suất không hợp lệ."); f["ls"] = None
    if f["ls"] is not None and not 0 <= f["ls"] <= 40: errs.append("Lãi suất phải trong khoảng 0–40%/năm.")
    for k in ("gn", "dh", "ngay_nguon"):
        try: f[k] = dt.date.fromisoformat(f[k]).isoformat() if f[k] else None
        except ValueError: errs.append(f"Ngày không hợp lệ ({k}).")
    if f["gn"] and f["dh"] and f["dh"] < f["gn"]: errs.append("Ngày đáo hạn trước ngày giải ngân.")
    f["ky_lai"] = int(f["ky_lai"]) if f["ky_lai"].isdigit() and 1 <= int(f["ky_lai"]) <= 31 else None
    if f["tt"] not in STATUSES or f["loai"] not in ("Ngắn hạn", "Dài hạn"): errs.append("Trạng thái/loại vay không hợp lệ.")
    if not allco(u) and f["cty"] not in mycos(u): errs.append("Bạn không có quyền với công ty này."); 
    if not f["ma"] or not f["cty"] or not f["nh"]: errs.append("Thiếu mã / công ty / ngân hàng.")
    return f, errs

def save(id=None):
    old = get_loan(id) if id else None
    f, errs = parse(request.form, g.user, old)
    if old: f["ma"] = old["ma"]
    if errs:
        for e in errs: flash(e, "e")
        return False
    if old:
        diff = {k: [old[k], f[k]] for k in FIELDS if old[k] != f[k]}
        db().execute("UPDATE loans SET " + ",".join(f"{k}=?" for k in FIELDS if k != "ma") + " WHERE id=?", [f[k] for k in FIELDS if k != "ma"] + [id])
        log("sửa", old["ma"], json.dumps(diff, ensure_ascii=False))
    else:
        try: db().execute("INSERT INTO loans(%s) VALUES(%s)" % (",".join(FIELDS), ",".join("?" * len(FIELDS))), [f[k] for k in FIELDS])
        except sqlite3.IntegrityError: flash("Mã khoản vay đã tồn tại.", "e"); return False
        log("thêm", f["ma"], json.dumps(f, ensure_ascii=False))
    db().commit(); flash("Đã lưu.", ""); return True

def cos_for_form():
    if g.user["role"] == "admin": return None
    if allco(g.user): return [r[0] for r in db().execute("SELECT DISTINCT cty FROM loans ORDER BY 1")]
    return mycos(g.user)

@app.route("/loans/new", methods=["GET", "POST"])
@login_required
def loan_new():
    if request.method == "POST" and save(): return redirect("/loans")
    return page(FORM, r=None, cos=cos_for_form())
@app.route("/loans/<int:id>", methods=["GET", "POST"])
@login_required
def loan_edit(id):
    if request.method == "POST" and save(id): return redirect("/loans")
    return page(FORM, r=get_loan(id), cos=cos_for_form())
@app.route("/loans/<int:id>/delete", methods=["POST"])
@admin_required
def loan_del(id):
    r = get_loan(id); log("xoá", r["ma"], json.dumps(dict(r), ensure_ascii=False))
    db().execute("DELETE FROM loans WHERE id=?", (id,)); db().commit(); flash("Đã xoá.", ""); return redirect("/loans")

@app.route("/admin/users", methods=["GET", "POST"])
@admin_required
def users():
    if request.method == "POST":
        a, f = request.form.get("a"), request.form
        if a == "new":
            if len(f["pw"]) < 8 or not f["username"].strip(): flash("Cần tên đăng nhập và mật khẩu ≥ 8 ký tự.", "e")
            else:
                try:
                    db().execute("INSERT INTO users(username,pw,role,companies) VALUES(?,?,?,?)", (f["username"].strip(), generate_password_hash(f["pw"]), "accountant", "|".join(f.getlist("cos"))))
                    log("tạo user", f["username"]); db().commit(); flash("Đã tạo tài khoản.", "")
                except sqlite3.IntegrityError: flash("Tên đăng nhập đã tồn tại.", "e")
        else:
            uid = int(f["id"])
            if a == "cos": db().execute("UPDATE users SET companies=? WHERE id=? AND role!='admin'", ("|".join(f.getlist("cos")), uid))
            if a == "pw" and len(f["pw"]) >= 8: db().execute("UPDATE users SET pw=? WHERE id=?", (generate_password_hash(f["pw"]), uid))
            if a == "toggle": db().execute("UPDATE users SET active=1-active WHERE id=? AND role!='admin'", (uid,))
            log("user:" + a, f.get("name", "")); db().commit(); flash("Đã cập nhật.", "")
        return redirect("/admin/users")
    us = db().execute("SELECT * FROM users ORDER BY role, username").fetchall()
    cos = [r[0] for r in db().execute("SELECT DISTINCT cty FROM loans ORDER BY 1")]
    return page("""<div class="box"><h2>Tạo tài khoản kế toán</h2><form method="post"><input type="hidden" name="_t" value="{{T}}"><input type="hidden" name="a" value="new">
<div class="row"><div><label>Tên đăng nhập</label><input name="username" required></div><div><label>Mật khẩu (≥ 8 ký tự)</label><input name="pw" required></div></div>
<label>Công ty phụ trách</label>{% for c in cos %}<label style="display:inline-block;margin-right:12px;color:var(--t)"><input type="checkbox" name="cos" value="{{c}}" style="width:auto"> {{c}}</label>{% endfor %}
<p><button class="btn">Tạo</button></p></form></div>
{% for u in us %}<div class="box"><b>{{u.username}}</b> <span class="tag">{{u.role}}</span> {% if not u.active %}<span class="tag e">đã khoá</span>{% endif %}
{% if u.role!='admin' %}<form method="post"><input type="hidden" name="_t" value="{{T}}"><input type="hidden" name="a" value="cos"><input type="hidden" name="id" value="{{u.id}}"><input type="hidden" name="name" value="{{u.username}}">
{% for c in cos %}<label style="display:inline-block;margin-right:12px;color:var(--t)"><input type="checkbox" name="cos" value="{{c}}" style="width:auto" {{'checked' if c in u.companies.split('|')}}> {{c}}</label>{% endfor %}
<button class="btn g">Lưu công ty</button></form>
<form method="post" class="row"><input type="hidden" name="_t" value="{{T}}"><input type="hidden" name="a" value="pw"><input type="hidden" name="id" value="{{u.id}}"><input name="pw" placeholder="Mật khẩu mới (≥ 8 ký tự)"><button class="btn g">Đặt lại mật khẩu</button></form>
<form method="post"><input type="hidden" name="_t" value="{{T}}"><input type="hidden" name="a" value="toggle"><input type="hidden" name="id" value="{{u.id}}"><button class="btn r">{{'Mở khoá' if not u.active else 'Khoá tài khoản'}}</button></form>{% endif %}</div>{% endfor %}""", us=us, cos=cos)

@app.route("/admin/audit")
@admin_required
def audit():
    rows = db().execute("SELECT * FROM audit ORDER BY id DESC LIMIT 300").fetchall()
    return page("""<div class="box"><h2>Nhật ký thay đổi (300 gần nhất)</h2><table><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Khoản</th><th>Chi tiết</th></tr>
{% for r in rows %}<tr><td style="white-space:nowrap">{{r.ts}}</td><td>{{r.user}}</td><td>{{r.action}}</td><td>{{r.ma}}</td><td style="font-size:12px;word-break:break-all">{{(r.detail or '')[:400]}}</td></tr>{% endfor %}</table></div>""", rows=rows)

init()
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
