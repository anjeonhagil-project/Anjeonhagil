"""Worker is single-threaded; a search-scoped connection probe cancels cooperatively."""
probe=None
class SearchCancelled(BaseException):pass
def check():
    if probe is not None and probe():raise SearchCancelled()
