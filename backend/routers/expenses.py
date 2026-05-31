from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import Expense, ExpenseCreate, ExpenseRead, ExpenseUpdate

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


@router.get("/", response_model=list[ExpenseRead])
def list_expenses(session: Session = Depends(get_session)):
    return session.exec(select(Expense).order_by(Expense.created_at.desc())).all()


@router.post("/", response_model=ExpenseRead, status_code=201)
def create_expense(expense: ExpenseCreate, session: Session = Depends(get_session)):
    db_expense = Expense.model_validate(expense)
    session.add(db_expense)
    session.commit()
    session.refresh(db_expense)
    return db_expense


@router.get("/{expense_id}", response_model=ExpenseRead)
def get_expense(expense_id: int, session: Session = Depends(get_session)):
    expense = session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.patch("/{expense_id}", response_model=ExpenseRead)
def update_expense(expense_id: int, updates: ExpenseUpdate, session: Session = Depends(get_session)):
    expense = session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    session.add(expense)
    session.commit()
    session.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, session: Session = Depends(get_session)):
    expense = session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    session.delete(expense)
    session.commit()
