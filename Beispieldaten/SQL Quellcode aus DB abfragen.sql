
SELECT 
    o.type_desc AS ObjektTyp,
    o.name AS ObjektName,
    m.definition AS Quellcode
FROM 
    sys.sql_modules m
JOIN 
    sys.objects o ON m.object_id = o.object_id
WHERE 
    o.type IN ('V', 'P', 'FN', 'IF', 'TF')  -- V=View, P=Procedure, FN=Scalar Function, IF=Inline Table Function, TF=Table-valued Function
    and (o.name like '%S4U_V%' or o.name like 'EF_4B%')
ORDER BY 
    o.type_desc, o.name;
