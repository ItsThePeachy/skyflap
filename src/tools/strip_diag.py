# strip_diag.py <in> <out> : removes test-only /*DIAG{*/ ... /*}DIAG*/ blocks (used for every stable build)
import re,sys
s=open(sys.argv[1],encoding='utf8').read()
o=re.sub(r'/\*DIAG\{\*/.*?/\*\}DIAG\*/','',s,flags=re.S)
assert 'DIAG{' not in o and '}DIAG' not in o and 'dgStart' not in o and 'dg:save' not in o, 'diag code left in stable build'
open(sys.argv[2],'w',encoding='utf8').write(o)
