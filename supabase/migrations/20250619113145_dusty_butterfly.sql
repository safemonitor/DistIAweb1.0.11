-- First check if the function exists and drop it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'execute_sql'
  ) THEN
    DROP FUNCTION execute_sql(text);
  END IF;
END $$;

-- Create a function to execute SQL queries securely
CREATE OR REPLACE FUNCTION execute_sql(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Uses the permissions of the function creator
AS $$
DECLARE
  result JSONB;
  query_lower TEXT;
BEGIN
  -- Convert query to lowercase for easier pattern matching
  query_lower := lower(query_text);
  
  -- Security checks to prevent destructive operations
  IF query_lower ~ 'drop\s+' THEN
    RAISE EXCEPTION 'DROP operations are not allowed';
  END IF;
  
  IF query_lower ~ 'truncate\s+' THEN
    RAISE EXCEPTION 'TRUNCATE operations are not allowed';
  END IF;
  
  IF query_lower ~ 'delete\s+from' THEN
    RAISE EXCEPTION 'DELETE operations are not allowed';
  END IF;
  
  IF query_lower ~ 'update\s+' THEN
    RAISE EXCEPTION 'UPDATE operations are not allowed';
  END IF;
  
  IF query_lower ~ 'insert\s+into' THEN
    RAISE EXCEPTION 'INSERT operations are not allowed';
  END IF;
  
  IF query_lower ~ 'alter\s+' THEN
    RAISE EXCEPTION 'ALTER operations are not allowed';
  END IF;
  
  IF query_lower ~ 'create\s+' THEN
    RAISE EXCEPTION 'CREATE operations are not allowed';
  END IF;
  
  IF query_lower ~ 'grant\s+' THEN
    RAISE EXCEPTION 'GRANT operations are not allowed';
  END IF;
  
  IF query_lower ~ 'revoke\s+' THEN
    RAISE EXCEPTION 'REVOKE operations are not allowed';
  END IF;
  
  -- Execute the query and convert results to JSON
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
  
  -- Return empty array instead of null for no results
  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'detail', SQLSTATE,
      'query', query_text
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION execute_sql IS 'Securely executes SQL queries for the chatbot, with safeguards against destructive operations';