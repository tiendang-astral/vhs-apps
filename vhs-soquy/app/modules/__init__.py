"""Đăng ký các nghiệp vụ. Thêm nghiệp vụ mới: tạo file module rồi thêm vào REGISTRY."""
from .cashbook import Cashbook
from .partner_payment import PartnerPayment
from .payroll import Payroll
from .cash_fund import CashFund

REGISTRY = {m.key: m for m in (Cashbook(), PartnerPayment(), Payroll(), CashFund())}


def get_module(key):
    from ..http import ApiError
    m = REGISTRY.get(key)
    if not m:
        raise ApiError(404, 'Nghiệp vụ không tồn tại')
    return m
