import tldextract

# Use the bundled PSL, including private suffixes, with no cache writes or network.
suffixes = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None, include_psl_private_domains=True)
