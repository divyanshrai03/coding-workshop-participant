import importlib.util
import pathlib

import pytest

BACKEND_DIR = pathlib.Path(__file__).parent


@pytest.fixture(scope="session")
def load_service_function():
    """Returns a loader that imports a service's function.py under a unique module name.

    Each service's function.py is loaded as e.g. "projects_service_function" rather than
    the bare name "function" so multiple services can be imported in one pytest session
    without colliding (Lambda itself never needs this - each service runs in its own
    isolated runtime). The bare-name shared-lib imports inside function.py (auth, db,
    errors, http_utils, router, validation) resolve to whichever copy is already cached
    in sys.modules - always _shared's, since pytest.ini puts `_shared` first on
    pythonpath - which is safe only because Terraform's sync_shared_lib provisioner
    (infra/lambda.tf) keeps every service's _lib/ copy byte-identical to _shared/.
    """

    def _load(service_name):
        module_name = f"{service_name.replace('-', '_')}_function"
        path = BACKEND_DIR / service_name / "function.py"
        spec = importlib.util.spec_from_file_location(module_name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    return _load
