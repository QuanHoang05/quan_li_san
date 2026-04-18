import re

with open('app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Update ImportRequest
req_old = """class ImportRequest(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float = 0.0
    supplier_name: Optional[str] = ""
    note: Optional[str] = ""
    selling_price: Optional[float] = None
    product_name: Optional[str] = None
    category: Optional[str] = "Khác"
    unit: Optional[str] = "cái\""""

req_new = """class ImportRequest(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float = 0.0
    supplier_name: Optional[str] = ""
    note: Optional[str] = ""
    selling_price: Optional[float] = None
    product_name: Optional[str] = None
    category: Optional[str] = "Khác"
    unit: Optional[str] = "cái"
    image_url: Optional[str] = None
    user_name: Optional[str] = None
    is_admin: bool = False"""

content = content.replace(req_old, req_new)

# Update import_stock
func_old = """async def import_stock(req: ImportRequest, db: AsyncSession = Depends(get_db)):
    \"\"\"Nhập kho: tăng tồn và ghi log, cập nhật giá hoặc tạo mới\"\"\"
    if req.product_id > 0:
        res = await db.execute(select(Product).where(Product.id == req.product_id))
        product = res.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        product.stock_quantity += req.quantity
        if req.unit_cost > 0:
            product.cost_price = req.unit_cost
        if req.selling_price is not None:
            product.price = req.selling_price
        
        if req.supplier_name:
            product.supplier_name = req.supplier_name
        elif product.supplier_name:
            req.supplier_name = product.supplier_name
            
        log = InventoryLog(
            product_id=req.product_id,
            change_amount=req.quantity,
            reason=LogReason.STOCK_IN,
            compensation_amount=req.unit_cost * req.quantity,
            status=LogStatus.APPROVED,
            note=f"NCC: {req.supplier_name} | {req.note}" if req.supplier_name else req.note
        )
        db.add(log)
        await db.commit()
        return {"ok": True, "new_stock": product.stock_quantity, "product_id": product.id}
    else:
        # Create new product
        if not req.product_name:
            raise HTTPException(status_code=400, detail="Product name is required for new product")
            
        new_p = Product(
            name=req.product_name,
            category=req.category or "Khác",
            price=req.selling_price or 0,
            cost_price=req.unit_cost,
            stock_quantity=req.quantity,
            unit=req.unit or "cái",
            min_stock=5,
            supplier_name=req.supplier_name
        )
        db.add(new_p)
        await db.flush()  # Get the new ID
        
        log = InventoryLog(
            product_id=new_p.id,
            change_amount=req.quantity,
            reason=LogReason.STOCK_IN,
            compensation_amount=req.unit_cost * req.quantity,
            status=LogStatus.APPROVED,
            note=f"Tạo mới & Nhập kho. NCC: {req.supplier_name} | {req.note}" if req.supplier_name else req.note
        )
        db.add(log)
        await db.commit()
        return {"ok": True, "new_stock": new_p.stock_quantity, "product_id": new_p.id}"""

func_new = """async def import_stock(req: ImportRequest, db: AsyncSession = Depends(get_db)):
    \"\"\"Nhập kho: tăng tồn và ghi log, cập nhật giá hoặc tạo mới\"\"\"
    status = LogStatus.APPROVED if req.is_admin else LogStatus.PENDING

    if req.product_id > 0:
        res = await db.execute(select(Product).where(Product.id == req.product_id))
        product = res.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        if status == LogStatus.APPROVED:
            product.stock_quantity += req.quantity
            if req.unit_cost > 0:
                product.cost_price = req.unit_cost
            if req.selling_price is not None:
                product.price = req.selling_price
            
            if req.supplier_name:
                product.supplier_name = req.supplier_name
        elif req.supplier_name and not product.supplier_name:
             # Just set it temporarily, if approved it stays
             pass
        elif product.supplier_name:
            req.supplier_name = product.supplier_name
        
        log = InventoryLog(
            product_id=req.product_id,
            change_amount=req.quantity,
            reason=LogReason.STOCK_IN,
            compensation_amount=req.unit_cost * req.quantity,
            status=status,
            note=f"NCC: {req.supplier_name} | {req.note}" if req.supplier_name else req.note,
            image_url=req.image_url,
            user_name=req.user_name
        )
        db.add(log)
        await db.commit()
        return {"ok": True, "new_stock": product.stock_quantity, "product_id": product.id, "status": status.value}
    else:
        # Create new product
        if not req.product_name:
            raise HTTPException(status_code=400, detail="Product name is required for new product")
            
        new_p = Product(
            name=req.product_name,
            category=req.category or "Khác",
            price=req.selling_price or 0,
            cost_price=req.unit_cost,
            stock_quantity=req.quantity if status == LogStatus.APPROVED else 0, # Don't add stock yet if pending
            unit=req.unit or "cái",
            min_stock=5,
            supplier_name=req.supplier_name
        )
        db.add(new_p)
        await db.flush()  # Get the new ID
        
        log = InventoryLog(
            product_id=new_p.id,
            change_amount=req.quantity,
            reason=LogReason.STOCK_IN,
            compensation_amount=req.unit_cost * req.quantity,
            status=status,
            note=f"Tạo mới & Nhập kho. NCC: {req.supplier_name} | {req.note}" if req.supplier_name else req.note,
            image_url=req.image_url,
            user_name=req.user_name
        )
        db.add(log)
        await db.commit()
        return {"ok": True, "new_stock": new_p.stock_quantity, "product_id": new_p.id, "status": status.value}"""

content = content.replace(func_old, func_new)

# Add Approve, Reject, Edit, Delete endpoints
additional_endpoints = """
class InventoryLogEditRequest(BaseModel):
    is_admin: bool = False
    change_amount: Optional[int] = None
    note: Optional[str] = None
    image_url: Optional[str] = None
    supplier_name: Optional[str] = None
    unit_cost: Optional[float] = None

@app.put("/api/v1/inventory/logs/{log_id}/approve")
async def approve_inventory_log(log_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryLog).options(joinedload(InventoryLog.product)).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if log.status == LogStatus.APPROVED:
        return {"ok": True, "message": "Already approved"}
        
    log.status = LogStatus.APPROVED
    
    # Increase stock
    if log.reason == LogReason.STOCK_IN:
        log.product.stock_quantity += log.change_amount
        
        # We can extract unit cost and selling price from somewhere if needed, but for now we'll just update stock
    await db.commit()
    return {"ok": True, "new_stock": log.product.stock_quantity}

@app.put("/api/v1/inventory/logs/{log_id}/reject")
async def reject_inventory_log(log_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryLog).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if log.status == LogStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Cannot reject an already approved log")
        
    log.status = LogStatus.REJECTED
    await db.commit()
    return {"ok": True}

@app.delete("/api/v1/inventory/logs/{log_id}")
async def delete_inventory_log(log_id: int, is_admin: bool = False, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryLog).options(joinedload(InventoryLog.product)).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if not is_admin and log.status != LogStatus.PENDING:
        raise HTTPException(status_code=403, detail="Staff can only delete pending logs")
        
    if log.status == LogStatus.APPROVED and log.reason == LogReason.STOCK_IN:
        log.product.stock_quantity -= log.change_amount
        if log.product.stock_quantity < 0:
            log.product.stock_quantity = 0
            
    await db.delete(log)
    await db.commit()
    return {"ok": True}

@app.put("/api/v1/inventory/logs/{log_id}")
async def update_inventory_log(log_id: int, req: InventoryLogEditRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryLog).options(joinedload(InventoryLog.product)).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if not req.is_admin and log.status != LogStatus.PENDING:
        raise HTTPException(status_code=403, detail="Staff can only edit pending logs")
        
    if req.note is not None:
        log.note = req.note
    if req.image_url is not None:
        log.image_url = req.image_url
        
    if req.change_amount is not None and req.change_amount != log.change_amount:
        if log.status == LogStatus.APPROVED and log.reason == LogReason.STOCK_IN:
            diff = req.change_amount - log.change_amount
            log.product.stock_quantity += diff
        log.change_amount = req.change_amount
        
    if req.unit_cost is not None:
        log.compensation_amount = req.unit_cost * log.change_amount
        
    await db.commit()
    return {"ok": True}
"""

content += additional_endpoints

with open('app/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
