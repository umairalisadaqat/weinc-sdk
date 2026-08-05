# Python

```
pip install weinc
```

## Quick start

```python
from weinc import WeInc

client = WeInc()  # reads WEINC_API_KEY from the environment

build = client.builds.create(prompt="a landing page for my coffee roastery")
print(build.url)

for project in client.projects.list():
    print(project.id, project.name)
```

## Configuration

| Setting | Environment variable | Default |
| --- | --- | --- |
| API key | `WEINC_API_KEY` | required |
| Base URL | `WEINC_BASE_URL` | `https://my.we.inc/api` |

Full product documentation lives at <https://we.inc>.
