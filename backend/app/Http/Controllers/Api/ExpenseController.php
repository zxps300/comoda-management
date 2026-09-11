<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ExpenseController extends Controller
{
    public function index()
    {
        // Get expenses sorted by latest first
        $expenses = Expense::orderBy('date', 'desc')->orderBy('id', 'desc')->get();
        return response()->json($expenses);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'date'        => 'required|date',
            'category'    => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'amount'      => 'required|numeric|min:0.01',
            'recorded_by' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $expense = Expense::create($validator->validated());

        return response()->json([
            'message' => 'Expense recorded successfully',
            'expense' => $expense
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $expense = Expense::find($id);

        if (!$expense) {
            return response()->json(['message' => 'Expense not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'date'        => 'required|date',
            'category'    => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'amount'      => 'required|numeric|min:0.01',
            'recorded_by' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $expense->update($validator->validated());

        return response()->json([
            'message' => 'Expense updated successfully',
            'expense' => $expense
        ]);
    }

    public function destroy($id)
    {
        $expense = Expense::find($id);

        if (!$expense) {
            return response()->json(['message' => 'Expense not found'], 404);
        }

        $expense->delete();

        return response()->json(['message' => 'Expense deleted successfully']);
    }
}
