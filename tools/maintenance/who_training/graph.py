from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Iterable

import msal
import requests


class GraphError(RuntimeError):
    pass


@dataclass(frozen=True)
class GraphAuth:
    tenant_id: str
    client_id: str


@dataclass(frozen=True)
class SharePointTarget:
    hostname: str  # e.g. worldhealthorg.sharepoint.com
    site_path: str  # e.g. /sites/EuroWCPHE


def _authority(tenant_id: str) -> str:
    return f"https://login.microsoftonline.com/{tenant_id}"


def acquire_token_device_code(*, auth: GraphAuth, scopes: list[str]) -> str:
    app = msal.PublicClientApplication(client_id=auth.client_id, authority=_authority(auth.tenant_id))
    flow = app.initiate_device_flow(scopes=scopes)
    if "user_code" not in flow or "message" not in flow:
        raise GraphError(f"Could not initiate device flow: {flow}")
    print(flow["message"])
    result = app.acquire_token_by_device_flow(flow)
    if "access_token" not in result:
        raise GraphError(f"Token acquisition failed: {json.dumps(result, indent=2)}")
    return str(result["access_token"])


def _graph_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def graph_get_json(*, token: str, url: str) -> dict[str, Any]:
    r = requests.get(url, headers=_graph_headers(token), timeout=30)
    if not r.ok:
        raise GraphError(f"GET {url} failed: {r.status_code} {r.text[:500]}")
    return r.json()


def graph_post_json(*, token: str, url: str, payload: dict[str, Any]) -> dict[str, Any]:
    r = requests.post(url, headers={**_graph_headers(token), "Content-Type": "application/json"}, json=payload, timeout=30)
    if not r.ok:
        raise GraphError(f"POST {url} failed: {r.status_code} {r.text[:500]}")
    return r.json()


def graph_patch_json(*, token: str, url: str, payload: dict[str, Any]) -> None:
    r = requests.patch(url, headers={**_graph_headers(token), "Content-Type": "application/json"}, json=payload, timeout=30)
    if not r.ok:
        raise GraphError(f"PATCH {url} failed: {r.status_code} {r.text[:500]}")


def resolve_site_id(*, token: str, target: SharePointTarget) -> str:
    # GET /sites/{hostname}:{server-relative-path}
    site_path = target.site_path if target.site_path.startswith("/") else f"/{target.site_path}"
    url = f"https://graph.microsoft.com/v1.0/sites/{target.hostname}:{site_path}"
    data = graph_get_json(token=token, url=url)
    site_id = data.get("id")
    if not site_id:
        raise GraphError(f"Site id not found in response for {target.hostname}:{site_path}")
    return str(site_id)


def resolve_list_id_by_title(*, token: str, site_id: str, list_title: str) -> str:
    # List displayName must match the list title
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/lists?$top=999"
    data = graph_get_json(token=token, url=url)
    lists = data.get("value", [])
    for li in lists:
        if str(li.get("displayName", "")).strip().lower() == list_title.strip().lower():
            list_id = li.get("id")
            if list_id:
                return str(list_id)
    raise GraphError(f"List not found by title: {list_title}")


def list_columns(*, token: str, site_id: str, list_id: str) -> list[dict[str, Any]]:
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/lists/{list_id}/columns?$top=999"
    data = graph_get_json(token=token, url=url)
    return list(data.get("value", []))


def iter_list_items_fields(
    *,
    token: str,
    site_id: str,
    list_id: str,
    select_fields: Iterable[str],
    page_size: int = 200,
) -> Iterable[tuple[str, dict[str, Any]]]:
    select = ",".join(select_fields)
    url = (
        f"https://graph.microsoft.com/v1.0/sites/{site_id}/lists/{list_id}/items"
        f"?$expand=fields($select={select})&$top={page_size}"
    )
    while url:
        data = graph_get_json(token=token, url=url)
        for it in data.get("value", []):
            item_id = str(it.get("id", ""))
            fields = it.get("fields") or {}
            yield item_id, dict(fields)
        url = str(data.get("@odata.nextLink") or "")


def update_item_fields(
    *, token: str, site_id: str, list_id: str, item_id: str, fields: dict[str, Any]
) -> None:
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/lists/{list_id}/items/{item_id}/fields"
    graph_patch_json(token=token, url=url, payload=fields)


def create_list_item(*, token: str, site_id: str, list_id: str, fields: dict[str, Any]) -> str:
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/lists/{list_id}/items"
    data = graph_post_json(token=token, url=url, payload={"fields": fields})
    item_id = data.get("id")
    if not item_id:
        raise GraphError("Created item did not return an id")
    return str(item_id)


def send_mail(
    *,
    token: str,
    subject: str,
    body_text: str,
    to_recipients: list[str],
) -> None:
    url = "https://graph.microsoft.com/v1.0/me/sendMail"
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body_text},
            "toRecipients": [{"emailAddress": {"address": a}} for a in to_recipients],
        }
    }
    r = requests.post(url, headers={**_graph_headers(token), "Content-Type": "application/json"}, json=payload, timeout=30)
    if r.status_code not in (202,):
        raise GraphError(f"sendMail failed: {r.status_code} {r.text[:500]}")

