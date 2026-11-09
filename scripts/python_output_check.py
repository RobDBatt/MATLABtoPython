"""Compile generated Python without executing it.

Canonical copy: VBAtoPython/api/_python_output_check.py.
The MATLAB repo vendors this file so it can build and test independently.
"""
import ast
import symtable


def inspect_python(code, required_aliases=()):
    """Return (AST, syntax error, missing global aliases)."""
    try:
        compile(code, "<generated Python>", "exec", dont_inherit=True)
        tree = ast.parse(code)
        symbols = symtable.symtable(code, "<generated Python>", "exec") if required_aliases else None
    except (RecursionError, MemoryError):
        return None, {
            "error": "Expression nested too deeply to analyse.",
            "line": None,
            "col": None,
            "text": None,
        }, []
    except SyntaxError as error:
        return None, {
            "error": error.msg,
            "line": error.lineno,
            "col": error.offset,
            "text": error.text.strip() if error.text else None,
        }, []

    missing = []
    for alias in required_aliases:
        if alias in symbols.get_identifiers():
            binding = symbols.lookup(alias)
            if binding.is_imported() or binding.is_assigned() or binding.is_namespace():
                continue
        if _references_global(symbols, alias):
            missing.append(alias)
    return tree, None, missing


def _references_global(scope, name):
    if name in scope.get_identifiers():
        symbol = scope.lookup(name)
        if symbol.is_global() and symbol.is_referenced():
            return True
    return any(_references_global(child, name) for child in scope.get_children())


if __name__ == "__main__":
    import json
    import sys

    _, error, missing = inspect_python(sys.stdin.buffer.read().decode("utf-8"), sys.argv[1:])
    if error or missing:
        print(json.dumps({"syntax_error": error, "missing_aliases": missing}))
        sys.exit(1)
