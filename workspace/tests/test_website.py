# filename: tests/test_website.py
import sys
import os
import pytest
from pathlib import Path

# Add parent directory to sys.path to allow importing files from root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import the main module (if it were a Python script, but it's not)
# Since the user requested an HTML website, there's no Python script to test.
# But for completeness, we can test if the HTML file is present and readable
# (if we were to simulate a "main.py" that generates or serves the website).

# We'll create a test that checks for the existence of the required files
# and that they are readable — this is the closest we can get to testing
# a web site in a Python context.

# NOTE: Since the actual website is HTML/CSS, there's no Python function
# to test. So we simulate testing via file existence and basic content.

def test_website_files_exist():
    # Check if index.html exists
    index_path = Path("index.html")
    assert index_path.exists(), "index.html is missing"

    # Check if styles.css exists
    css_path = Path("styles.css")
    assert css_path.exists(), "styles.css is missing"

    # Optional: Check if the files are readable
    assert index_path.is_file(), "index.html is not a file"
    assert css_path.is_file(), "styles.css is not a file"

    # Optional: Check basic content (if needed for more robust testing)
    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()
        assert '<!DOCTYPE html>' in content, "index.html does not start with DOCTYPE"
        assert '<title>Sito Web Semplice</title>' in content, "Title tag not found"

    with open(css_path, 'r', encoding='utf-8') as f:
        content = f.read()
        assert 'body {' in content, "styles.css does not contain body selector"
        assert 'background-color: #f9f9f9;' in content, "Background color not set correctly"

# If you were to test a web server or a Python script that serves this site,
# you would use a different approach. Since none exists, we leave this as a
# minimal test suite.

# However, if the user intended to test a Python script (e.g., `main.py`)
# that generates or serves the site, please provide the script. Otherwise,
# this test suite covers the static HTML/CSS files.

# You can run this test with:
#   pytest tests/test_website.py