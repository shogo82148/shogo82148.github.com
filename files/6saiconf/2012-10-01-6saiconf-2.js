var axioms = [formula('>P>QP'), formula('>>P>QR>>PQ>PR'), formula('>>~P~Q>QP')];
function formula(s) {
    var n = node();
    if(s != '') return null;
    return n;

    function next() {
        s = s.substring(1);
    }

    function node() {
        if(!s) return null;
        var ch = s.charAt(0);
        var a, b;
        switch(ch) {
        case 'P':
        case 'Q':
        case 'R':
            next();
            return [ch];
        case '~':
            next();
            a = node();
            if(a) return ['~', a];
            else return null;
        case '>':
            next();
            a = node();
            b = node();
            if(a && b) return ['>', a, b];
            return null;
        }
        return null;
    }
}

function check_axioms(theories, f) {
    var i;
    var variables, flag;
    for(i = 0; i < theories.length; ++i) {
        variables = {};
        flag = (function cmp(a, b) {
            if('A' <= a[0] && a[0] <= 'Z') {
                if(variables[a[0]]) {
                    return equals(variables[a[0]], b);
                } else {
                    variables[a[0]] = b;
                    return true;
                }
            } else if(a[0] == '~') {
                if(b[0] != '~') return false;
                return cmp(a[1], b[1]);
            } else if(a[0] == '>') {
                if(b[0] != '>') return false;
                return cmp(a[1], b[1]) && cmp(a[2], b[2]);
            }
            return false;
        })(theories[i], f);
        if(flag) return true;
    }
    return false;
}

function generate(n) {
    var set = [];
    var i;
    for(i = 1; i <= n; ++i) {
        (function search(i, s){
            var f;
            if(i==0) {
                f = formula(s);
                if(f) set.push(s);
            } else {
                search(i-1, s + 'P');
                search(i-1, s + 'Q');
                search(i-1, s + 'R');
                search(i-1, s + '~');
                search(i-1, s + '>');
            }
        })(i, '');
    }
    return set;
}

function equals(a, b) {
    if(a[0] != b[0]) return false;
    if(a[0]=='~') return equals(a[1], b[1]);
    if(a[0]=='>') return equals(a[1], b[1]) && equals(a[2], b[2]);
    return true;
}

function modus_ponens(theories, f) {
    if(f[0] != '>') return null;
    if(check_axioms(theories, f[1]) && check_axioms(theories, f)) return f[2];
    return null;
}

function tostring(a) {
    var s = a[0];
    var i;
    for(i = 1; i < a.length; ++i) {
        s += tostring(a[i]);
    }
    return s;
}

function normalize(s) {
    var variables = {};
    var symbols = ['R', 'Q', 'P'];
    return s.replace(/[A-Z]/g, function(m) {
        if(variables[m]) return variables[m];
        return variables[m] = symbols.pop();
    });
}

function search(n) {
    var new_theory = {};
    var node = generate(n);
    var i, j, k, l;
    var f;

    for(i = 0; i < axioms.length; ++i) {
        new_theory[tostring(axioms[i])] = false;
    }

    for(i = 0; i < node.length; ++i) {
        for(j = 0; j < node.length; ++j) {
            for(k = 0; k < node.length; ++k) {
                for(l = 0; l < axioms.length; ++l) {
                    f = tostring(axioms[l]).replace(/[A-Z]/g, function(m) {
                        switch(m) {
                        case 'P':
                            return node[i];
                        case 'Q':
                            return node[j];
                        case 'R':
                            return node[k];
                        }
                        return m;
                    });
                    f = modus_ponens(axioms, formula(f));
                    if(f) {
                        f = normalize(tostring(f));
                        if(f in new_theory) continue;
                        postMessage({
                            formula: f,
                            theorem: tostring(axioms[l]),
                            P: node[i],
                            Q: node[j],
                            R: node[k]
                        });
                        new_theory[f] = true;
                    }
                }
            }
        }
    }

    for(i in new_theory) {
        if(new_theory[i]) axioms.push(formula(i));
    }
}

addEventListener('message', function(e) {
    search(e.data);
    postMessage({
        msg: 'finish'
    });
}, false);
