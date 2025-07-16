ALTER procedure [dbo].[db_S4U_V3_PYLIST] (@S_PL_ID int, @VT_IDS nvarchar(MAX))
as

-- declare @S_PL_ID int = 0
-- declare @VT_IDS nvarchar(MAX) = '1'

/* Select relevant value types (for planning year filter) */
declare @S_VT_IDS tpID
if isnull(@VT_IDS,'*') = '*' insert into @S_VT_IDS Select S_VT_ID from S_VT -- bei * werden alle Wertetyoen eingetragen 
else insert into  @S_VT_IDS 
    Select distinct S_VT_ID from 
        (select S_VT_ID from S_VT
        inner join (Select value from string_split(@VT_IDS,';')) X on X.value = S_VT_ID  
        ) P
/* END of S_VT determination */ 

declare @PY_IDS tpID
insert into @PY_IDS select S_PY_ID from S_PY inner join @S_VT_IDS V on S_VT_ID = V.ID
-- insert into @PY_IDS select S_PY_ID from S_PY where S_PYT_ID not in (Select distinct S_PYT_ID from S_PY inner join @PY_IDS P on S_PY.S_PY_ID = P.ID)

declare @MYUSER_ID int
Select @MYUSER_ID = @S_PL_ID from S_PL where S_PL_ID = @S_PL_ID and S_PL.S_PL_OSUSER = SYSTEM_USER and S_PL_LOCKED = 0
if isnull(@MYUSER_ID,0) <= 0 Select @MYUSER_ID = min(S_PL_ID) from S_PL where S_PL_OSUSER = SYSTEM_USER and S_PL_LOCKED = 0

--aktuelle Datenart und Periode ermitteln
declare @CURRPY nvarchar(50) = '-'
declare @CURRPER int

Select @CURRPY = S_PY_KEY, @CURRPER = month(MINDATE)
from S_PY 
inner join  
(
Select dateadd(mm,-1,min(DATE_FY)) as MINDATE
from (Select * from S_PY cross join S_PER) PY
inner join db_S4U_V2_PY_DATES D on D.S_PY_ID = PY.S_PY_ID and D.S_PER_ID = PY.S_PER_ID and PY.S_PER_ID = PY.S_PY_EDITFROM
inner join S_VT on S_VT.S_VT_ID = PY.S_VT_ID 
where S_VT_CONTINUOUS = 1
) X
on S_PY_YEAR = Year(MINDATE) 
inner join S_VT on S_VT.S_VT_ID = S_PY.S_VT_ID 
where S_VT_CONTINUOUS = 1

if @CURRPY = '-' 
    begin
        select @CURRPY = (Select S_PY_KEY from S_PY where S_PY_YEAR = (Select min(S_PY_YEAR) from S_PY inner join S_VT on S_VT.S_VT_ID = S_PY.S_VT_ID where S_VT_CONTINUOUS = 1) )
        select @CURRPER = 1
    end
--ENDE aktuelle Datenart und Periode ermitteln

-- Daten ausgeben
select  p.S_PY_ID, S_PY_KEY, S_PY_T_DESC S_PY_DESC, iif(upper(S_PYT_DESC) in ('CY','FY'),'X',NULL) as PY_DEFAULT, S_VT_DESC, S_VT_CONTINUOUS, S_PYT_DESC, 
        iif(S_PY_KEY = @CURRPY,'CURRPY',null) as ISCURRPY, @CURRPER as CURRENTPERIOD,
        iif(S_PYT.S_PYT_DESC = 'P3Y',1,null) as isP3Y,
        iif(S_PYT.S_PYT_DESC = 'P2Y',1,null) as isP2Y,
        iif(S_PYT.S_PYT_DESC = 'PY',1,null) as isPY,
        iif(S_PYT.S_PYT_DESC = 'CY',1,null) as isCY,
        iif(S_PYT.S_PYT_DESC = 'PCY',1,null) as isPCY,
        iif(S_PYT.S_PYT_DESC = 'FY',1,null) as isFY,
        iif(S_PYT.S_PYT_DESC = 'F2Y',1,null) as isF2Y,
        iif(S_PYT.S_PYT_DESC = 'F3Y',1,null) as isF3Y,
        iif(S_VT.S_VT_CONTINUOUS = 1,1,null) as isCONTINUOUS,
        iif(S_VT.S_VT_CONTINUOUS = 1 and S_PY.S_PY_EDITFROM < 13,1,null) as isOPEN_CONTINUOUS

from S_RL_PY p
inner join S_PY on S_PY.S_PY_ID = p.S_PY_ID
inner join @PY_IDS PYIDS on PYIDS.ID = S_PY.S_PY_ID
inner join S_PL on S_PL.S_PL_ID = @MYUSER_ID 
inner join S_PY_T on S_PY_T.S_PY_ID = S_PY.S_PY_ID and S_PY_T.S_LNG_ID = S_PL.S_LNG_ID
inner join S_VT on S_VT.S_VT_ID = S_PY.S_VT_ID
inner join
(
    select  distinct S_RL_ID
    from S_RL_PL
    where S_PL_ID = @MYUSER_ID
    union
    select S_RL_ID
    from S_PL
    where S_PL_ID = @MYUSER_ID
) rl 
    on rl.S_RL_ID = p.S_RL_ID   
left join S_PYT on S_PYT.S_PYT_ID = S_PY.S_PYT_ID
where S_PY_INACTIVE = 0 or S_PY_SHOW = 1
group by p.S_PY_ID, S_PY_EDITFROM, S_PY_KEY, S_PY_T_DESC, iif(upper(S_PY_TAG)='DEFAULT','X',NULL), S_VT_DESC, S_VT_CONTINUOUS, S_PYT_DESC
having MAX(p.S_RL_PY_PERMISSION) > 0   

